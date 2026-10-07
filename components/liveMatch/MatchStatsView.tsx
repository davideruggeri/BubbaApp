// components/liveMatch/MatchStatsView.tsx
// Componente per la tab Statistiche della partita: KPI di squadra, tabella individuali, mappa pull, mappa turnover e cronologia eventi

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { styles } from './liveMatchStyles';
import { useTheme } from '../../context/ThemeContext';
import TeamKpiCard from './TeamKpiCard';
import PlayerStatsTable from './PlayerStatsTable';
import PlayerDetailModal from './PlayerDetailModal';
import ScoreProgressionChart from './ScoreProgressionChart';
import MatchTimelineCard from './MatchTimelineCard';
import InteractiveField, { FieldDot, FieldTrajectory } from '../InteractiveField';
import { describeEvent, attRight, pullZone, isOB } from '../../utils/statsEngine';
import { MatchAnalysis } from '../../services/firestore';

interface ActionDetailModalData {
    event: any;
    point: any;
    pointIndex: number;
    kind: string;
    scoreUs: number;
    scoreThem: number;
    targetEndzone: string;
    startType: 'O' | 'D';
    throwerName?: string;
    receiverName?: string;
    defenderName?: string;
    defenseSchema?: string;
    coordX?: number;
    coordY?: number;
}

interface PullDetailModalData {
    eventIndex: number;
    pointNumber: number;
    pullEvent: any;
    pullerName: string;
    team: 'us' | 'them';
    coord: { x: number; y: number };
}

interface MatchStatsViewProps {
    tStats: any;
    pStats: Record<string, any>;
    isMobile: boolean;
    statsSortKey: string;
    statsSortAsc: boolean;
    onToggleSort: (key: string) => void;
    P: (id: string) => { name: string; g: 'M' | 'F' };
    st: any;
    match: MatchAnalysis;
    playerMap: Record<string, { name: string; g: 'M' | 'F' }>;
    canEdit?: boolean;
    onUpdatePullCoord?: (eventIndex: number, newCoord: { x: number; y: number }) => Promise<void>;
}

export default function MatchStatsView({
    tStats,
    pStats,
    isMobile,
    statsSortKey,
    statsSortAsc,
    onToggleSort,
    P,
    st,
    match,
    playerMap,
    canEdit = false,
    onUpdatePullCoord,
}: MatchStatsViewProps) {
    const { theme } = useTheme();

    const [statsFilter, setStatsFilter] = useState<string>('all');
    const [toStatsFilter, setToStatsFilter] = useState<'all' | 'toUs' | 'toThem'>('all');
    const [toOriginFilter, setToOriginFilter] = useState<'all' | 'O' | 'D'>('all');
    const [toFieldFlip, setToFieldFlip] = useState<boolean>(false);
    const [selectedAction, setSelectedAction] = useState<ActionDetailModalData | null>(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [selectedPull, setSelectedPull] = useState<PullDetailModalData | null>(null);
    const [isEditingPull, setIsEditingPull] = useState<boolean>(false);
    const [tempPullCoord, setTempPullCoord] = useState<{ x: number; y: number } | null>(null);
    const [isSavingPull, setIsSavingPull] = useState<boolean>(false);

    const ids = Object.keys(pStats).sort((a, b) => {
        const valA = (pStats[a] as any)[statsSortKey] ?? 0;
        const valB = (pStats[b] as any)[statsSortKey] ?? 0;
        if (valA !== valB) {
            return statsSortAsc ? valA - valB : valB - valA;
        }
        return P(a).name.localeCompare(P(b).name);
    });

    // Punti pull da mostrare nella mappa
    const pullDots: FieldDot[] = [];
    let totalPulls = 0;
    let usPulls = 0;
    let themPulls = 0;

    for (const pt of st.points) {
        const pl = pt.pull;
        if (!pl || pl.x == null || pl.y == null) continue;
        totalPulls++;
        if (pl.team === 'us') usPulls++; else themPulls++;

        const show =
            statsFilter === 'all' ||
            (statsFilter === 'us' && pl.team === 'us') ||
            (statsFilter === 'them' && pl.team === 'them') ||
            statsFilter === pl.p;

        if (show) {
            pullDots.push({
                x: pl.x,
                y: pl.y,
                c: pl.team === 'us' ? '#003057' : '#E07A1F',
                r: 1.2,
                label: pl.p ? P(pl.p).name.slice(0, 3).toUpperCase() : undefined,
                onPress: () => {
                    const evIdx = (match.events || []).findIndex(e => e === pl || (e.k === 'pull' && e.t === pl.t));
                    setSelectedPull({
                        eventIndex: evIdx,
                        pointNumber: pt.n,
                        pullEvent: pl,
                        pullerName: pl.p ? P(pl.p).name : (pl.team === 'us' ? 'Bubba' : (match.opponent || 'Avversari')),
                        team: pl.team as 'us' | 'them',
                        coord: { x: pl.x!, y: pl.y! },
                    });
                    setIsEditingPull(false);
                    setTempPullCoord(null);
                }
            });
        }
    }

    // Punti e Traiettorie Turnover & Difese da mostrare nella mappa
    const toDots: FieldDot[] = [];
    const toTrajectories: FieldTrajectory[] = [];
    let toUsCount = 0;
    let toThemCount = 0;
    let oPointCount = 0;
    let dPointCount = 0;

    // Calcolo punteggio progressivo all'inizio di ciascun punto
    const pointScores: { us: number; them: number }[] = [];
    let curScoreUs = 0;
    let curScoreThem = 0;
    for (let i = 0; i < (st.points || []).length; i++) {
        pointScores.push({ us: curScoreUs, them: curScoreThem });
        const p = st.points[i];
        if (p.result === 'us') curScoreUs++;
        else if (p.result === 'them') curScoreThem++;
    }

    for (let ptIdx = 0; ptIdx < (st.points || []).length; ptIdx++) {
        const pt = st.points[ptIdx];
        const pScore = pointScores[ptIdx] || { us: 0, them: 0 };
        const isAttackingRight = attRight(match, pt.n, st.halfTimePoint);
        const targetEndzone = isAttackingRight ? 'Destra' : 'Sinistra';

        for (const e of pt.ev) {
            if (!e || e.x == null || e.y == null) continue;
            const isToUs = e.k === 'tt' || e.k === 'td' || e.k === 'ts' || e.k === 'tx';
            const isToThem = e.k === 'err' || e.k === 'd' || e.k === 'call';
            if (!isToUs && !isToThem) continue;

            if (isToUs) toUsCount++;
            else if (isToThem) toThemCount++;

            if (pt.o) oPointCount++;
            else dPointCount++;

            let matchType = false;
            if (toStatsFilter === 'all') matchType = true;
            else if (toStatsFilter === 'toUs') matchType = isToUs;
            else if (toStatsFilter === 'toThem') matchType = isToThem;

            let matchOrigin = false;
            if (toOriginFilter === 'all') matchOrigin = true;
            else if (toOriginFilter === 'O') matchOrigin = !!pt.o;
            else if (toOriginFilter === 'D') matchOrigin = !pt.o;

            if (matchType && matchOrigin) {
                const isDefense = e.k === 'd';
                const isThem = isDefense || e.k === 'call' || e.k === 'err';
                const color = isDefense ? '#2E8540' : (isThem ? '#E07A1F' : (pt.o ? '#C8323C' : '#1F6FD1'));
                let shortCode = 'TO';
                if (e.k === 'tt') shortCode = 'LAN';
                else if (e.k === 'td') shortCode = 'PRE';
                else if (e.k === 'ts') shortCode = 'STL';
                else if (e.k === 'tx') shortCode = 'TO';
                else if (e.k === 'd') shortCode = 'D';
                else if (e.k === 'call') shortCode = 'CAL';
                else if (e.k === 'err') shortCode = 'ERR';

                const pName = e.p ? P(e.p).name.slice(0, 3).toUpperCase() : undefined;

                let dotX = e.x;
                let dotY = e.y;
                if (e.trajectory && e.trajectory.length >= 2) {
                    if (e.k === 'tt') {
                        // Lanciatore all'inizio della freccia
                        dotX = e.trajectory[0].x;
                        dotY = e.trajectory[0].y;
                    } else if (e.k === 'td') {
                        // Ricevitore alla fine della freccia
                        dotX = e.trajectory[e.trajectory.length - 1].x;
                        dotY = e.trajectory[e.trajectory.length - 1].y;
                    }
                }

                let throwerName: string | undefined = undefined;
                let receiverName: string | undefined = undefined;
                let defenderName: string | undefined = undefined;

                if (e.k === 'tt') {
                    throwerName = e.p ? P(e.p).name : 'Non specificato';
                } else if (e.k === 'td') {
                    receiverName = e.p ? P(e.p).name : 'Non specificato';
                    const evIdx = pt.ev.indexOf(e);
                    for (let j = evIdx - 1; j >= 0; j--) {
                        const prev = pt.ev[j];
                        if (prev.k === 'touch' && prev.p && prev.p !== e.p) {
                            throwerName = P(prev.p).name;
                            break;
                        } else if (prev.k === 'd' && prev.p && prev.p !== e.p) {
                            throwerName = P(prev.p).name;
                            break;
                        }
                    }
                    if (!throwerName) {
                        const firstTouch = pt.ev.find((item: any) => item.k === 'touch' && item.p && item.p !== e.p);
                        if (firstTouch) throwerName = P(firstTouch.p).name;
                        else throwerName = 'Non registrato';
                    }
                } else if (e.k === 'd' || e.k === 'call') {
                    defenderName = e.p ? P(e.p).name : 'Senza giocatore';
                }

                const dsetEv = pt.ev.find((item: any) => item.k === 'dset');
                const defenseSchema = dsetEv ? dsetEv.v : undefined;

                const actionData: ActionDetailModalData = {
                    event: e,
                    point: pt,
                    pointIndex: pt.n,
                    kind: e.k,
                    scoreUs: pScore.us,
                    scoreThem: pScore.them,
                    targetEndzone,
                    startType: pt.o ? 'O' : 'D',
                    throwerName,
                    receiverName,
                    defenderName,
                    defenseSchema,
                    coordX: dotX,
                    coordY: dotY,
                };

                toDots.push({
                    x: dotX,
                    y: dotY,
                    c: color,
                    r: 1.2,
                    label: pName ? pName : shortCode,
                    onPress: () => setSelectedAction(actionData),
                    data: actionData
                });

                // Le difese sono indicate solo con un punto sullo schermo e mai con traiettoria
                if (!isDefense && e.trajectory && e.trajectory.length >= 2) {
                    toTrajectories.push({
                        points: e.trajectory,
                        color,
                        label: pName,
                        onPress: () => setSelectedAction(actionData),
                        data: actionData
                    });
                }
            }
        }
    }
    const totalLocEvents = toUsCount + toThemCount;

    return (
        <ScrollView style={styles.statsScroll} contentContainerStyle={styles.statsScrollContent}>
            {/* KPI Squadra */}
            <TeamKpiCard tStats={tStats} isMobile={isMobile} />

            {/* Grafico Andamento Partita */}
            <ScoreProgressionChart
                points={st.points}
                opponentName={match.opponent}
                isMobile={isMobile}
                P={P}
            />

            {/* Tabella Giocatori */}
            <PlayerStatsTable
                ids={ids}
                pStats={pStats}
                getPlayer={id => ({ name: P(id).name, g: P(id).g })}
                statsSortKey={statsSortKey}
                statsSortAsc={statsSortAsc}
                onToggleSort={onToggleSort}
                onSelectPlayer={setSelectedPlayerId}
            />

            {/* Mappa Pull */}
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 2 }]}>Mappa Pull</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            Totale: {totalPulls} ({usPulls} nostri · {themPulls} avversari) · Tocca un pallino per dettagli o modifica
                        </Text>
                    </View>
                </View>

                {/* Filtri e Legenda */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, flexWrap: 'wrap', gap: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: `Tutti (${totalPulls})` },
                            { key: 'us', label: `Nostri (${usPulls})` },
                            { key: 'them', label: `Loro (${themPulls})` }
                        ].map(f => (
                            <TouchableOpacity
                                key={f.key}
                                style={[
                                    styles.filterChip,
                                    statsFilter === f.key
                                        ? styles.filterChipOn
                                        : {
                                            backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                            borderColor: theme.dark ? '#334155' : '#CBD5E1'
                                        }
                                ]}
                                onPress={() => setStatsFilter(f.key)}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        statsFilter === f.key
                                            ? styles.filterChipTextOn
                                            : { color: theme.colors.text }
                                    ]}
                                >
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#003057' }} />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary }}>Nostri</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#E07A1F' }} />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary }}>Loro</Text>
                        </View>
                    </View>
                </View>

                <InteractiveField
                    dots={pullDots}
                    interactive={false}
                    isPlayMode={false}
                    flip={toFieldFlip}
                />
            </View>

            {/* Mappa Turnover & Difese */}
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 2 }]}>
                            Mappa Turnover & Difese
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            Totale: {totalLocEvents} ({toUsCount} TO nostri · {toThemCount} TO avversari)
                        </Text>
                    </View>
                </View>

                {/* Filtri e Legenda */}
                <View style={{ marginTop: 10, marginBottom: 8, gap: 8 }}>
                    {/* Filtro Mete / Punti (Attacco vs Difesa) */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary }}>Mete:</Text>
                        {[
                            { key: 'all', label: `Tutte (${totalLocEvents})` },
                            { key: 'O', label: `⚡ Attacco (${oPointCount})` },
                            { key: 'D', label: `🛡️ Difesa (${dPointCount})` }
                        ].map(f => (
                            <TouchableOpacity
                                key={f.key}
                                style={[
                                    styles.filterChip,
                                    toOriginFilter === f.key
                                        ? {
                                            backgroundColor: f.key === 'O' ? '#C8323C' : f.key === 'D' ? '#1F6FD1' : '#003057',
                                            borderColor: f.key === 'O' ? '#A8252F' : f.key === 'D' ? '#1756A4' : '#003057'
                                        }
                                        : {
                                            backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                            borderColor: theme.dark ? '#334155' : '#CBD5E1'
                                        }
                                ]}
                                onPress={() => setToOriginFilter(f.key as any)}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        {
                                            color: toOriginFilter === f.key ? '#fff' : theme.colors.text,
                                            fontWeight: toOriginFilter === f.key ? 'bold' : '600'
                                        }
                                    ]}
                                >
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Filtro Tipo Evento e Legenda */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                            {[
                                { key: 'all', label: `Tutti` },
                                { key: 'toUs', label: `TO Nostri (${toUsCount})` },
                                { key: 'toThem', label: `TO Loro (${toThemCount})` }
                            ].map(f => (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[
                                        styles.filterChip,
                                        toStatsFilter === f.key
                                            ? styles.filterChipOn
                                            : {
                                                backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                                borderColor: theme.dark ? '#334155' : '#CBD5E1'
                                            }
                                    ]}
                                    onPress={() => setToStatsFilter(f.key as any)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            toStatsFilter === f.key
                                                ? styles.filterChipTextOn
                                                : { color: theme.colors.text }
                                        ]}
                                    >
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#C8323C' }} />
                                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>Nostri (O)</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#1F6FD1' }} />
                                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>Nostri (D)</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#2E8540' }} />
                                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>Difese (D)</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#E07A1F' }} />
                                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>Avversari</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <InteractiveField
                    dots={toDots}
                    trajectories={toTrajectories}
                    interactive={false}
                    isPlayMode={true}
                    flip={toFieldFlip}
                    onFlipDirection={() => setToFieldFlip(prev => !prev)}
                />
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                    💡 Tocca un pallino o una freccia sul campo per aprire i dettagli completi dell'azione
                </Text>
            </View>

            {/* Modal Dettaglio Azione / Turnover / Difesa */}
            <Modal
                visible={!!selectedAction}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedAction(null)}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 16
                    }}
                    activeOpacity={1}
                    onPress={() => setSelectedAction(null)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 420,
                            backgroundColor: theme.colors.card,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                            padding: 20,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 10,
                            elevation: 10
                        }}
                    >
                        {selectedAction && (() => {
                            const isThrowTO = selectedAction.kind === 'tt';
                            const isCatchTO = selectedAction.kind === 'td';
                            const isStallTO = selectedAction.kind === 'ts';
                            const isDefense = selectedAction.kind === 'd';
                            const isCallahan = selectedAction.kind === 'call';
                            const isOppError = selectedAction.kind === 'err';

                            const headerColor = isDefense ? '#2E8540'
                                : isCallahan ? '#7A5AA8'
                                : isOppError ? '#E07A1F'
                                : (selectedAction.startType === 'O' ? '#C8323C' : '#1F6FD1');

                            const title = isThrowTO ? 'ERRORE DI LANCIO'
                                : isCatchTO ? 'ERRORE DI PRESA'
                                : isDefense ? 'DIFESA EFFETTUATA'
                                : isCallahan ? 'CALLAHAN'
                                : isStallTO ? 'STALL OUT'
                                : isOppError ? 'ERRORE AVVERSARIO'
                                : 'TURNOVER';

                            const icon = isThrowTO ? '🥏❌'
                                : isCatchTO ? '🤲❌'
                                : isDefense ? '🛡️✓'
                                : isCallahan ? '⭐🛡️'
                                : isStallTO ? '⏱️'
                                : isOppError ? '⚠️'
                                : '🥏';

                            return (
                                <>
                                    {/* Header del Modale */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                        <View style={{
                                            backgroundColor: headerColor,
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 8
                                        }}>
                                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{icon} {title}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setSelectedAction(null)}
                                            style={{
                                                padding: 6,
                                                backgroundColor: theme.dark ? '#334155' : '#E2E8F0',
                                                borderRadius: 20,
                                                width: 28,
                                                height: 28,
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Scheda Contesto Punteggio e Punto */}
                                    <View style={{
                                        backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC',
                                        borderRadius: 10,
                                        padding: 12,
                                        marginBottom: 14,
                                        borderWidth: 1,
                                        borderColor: theme.dark ? '#334155' : '#E2E8F0',
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <View>
                                            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, textTransform: 'uppercase' }}>
                                                Punto #{selectedAction.pointIndex}
                                            </Text>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginTop: 2 }}>
                                                Bubba {selectedAction.scoreUs} - {selectedAction.scoreThem} {match.opponent}
                                            </Text>
                                        </View>
                                        <View style={{
                                            paddingHorizontal: 10,
                                            paddingVertical: 5,
                                            borderRadius: 8,
                                            backgroundColor: selectedAction.startType === 'O' ? '#C8323C22' : '#1F6FD122',
                                            borderWidth: 1,
                                            borderColor: selectedAction.startType === 'O' ? '#C8323C' : '#1F6FD1'
                                        }}>
                                            <Text style={{
                                                fontSize: 12,
                                                fontWeight: 'bold',
                                                color: selectedAction.startType === 'O' ? '#C8323C' : '#1F6FD1'
                                            }}>
                                                {selectedAction.startType === 'O' ? '⚡ Inizio Attacco (O)' : '🛡️ Inizio Difesa (D)'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Dettagli Giocatori e Meta */}
                                    <View style={{ gap: 10, marginBottom: 16 }}>
                                        {/* Chi ha fatto il lancio */}
                                        {selectedAction.throwerName && (
                                            <View style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                paddingVertical: 8,
                                                borderBottomWidth: 1,
                                                borderBottomColor: theme.colors.border,
                                                flexWrap: 'wrap',
                                                gap: 6
                                            }}>
                                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, flexShrink: 1 }}>
                                                    {isThrowTO ? 'Chi ha sbagliato il lancio:' : 'Chi ha fatto il passaggio:'}
                                                </Text>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text, flexShrink: 1, textAlign: 'right' }}>
                                                    🥏 {selectedAction.throwerName}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Chi ha sbagliato la ricezione */}
                                        {selectedAction.receiverName && (
                                            <View style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                paddingVertical: 8,
                                                borderBottomWidth: 1,
                                                borderBottomColor: theme.colors.border,
                                                flexWrap: 'wrap',
                                                gap: 6
                                            }}>
                                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, flexShrink: 1 }}>
                                                    Chi ha sbagliato a ricevere:
                                                </Text>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#C8323C', flexShrink: 1, textAlign: 'right' }}>
                                                    🤲 {selectedAction.receiverName}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Chi ha fatto la difesa */}
                                        {selectedAction.defenderName && (
                                            <View style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                paddingVertical: 8,
                                                borderBottomWidth: 1,
                                                borderBottomColor: theme.colors.border,
                                                flexWrap: 'wrap',
                                                gap: 6
                                            }}>
                                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, flexShrink: 1 }}>
                                                    Difesa effettuata da:
                                                </Text>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#2E8540', flexShrink: 1, textAlign: 'right' }}>
                                                    🛡️ {selectedAction.defenderName}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Meta verso cui si attaccava */}
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            paddingVertical: 8,
                                            borderBottomWidth: 1,
                                            borderBottomColor: theme.colors.border
                                        }}>
                                            <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                                                Meta di attacco Bubba:
                                            </Text>
                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                                🚩 Meta a {selectedAction.targetEndzone}
                                            </Text>
                                        </View>


                                        {/* Schema di difesa (se registrato) */}
                                        {selectedAction.defenseSchema && (
                                            <View style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                paddingVertical: 8,
                                                borderBottomWidth: 1,
                                                borderBottomColor: theme.colors.border
                                            }}>
                                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                                                    Schema difensivo attivo:
                                                </Text>
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#E07A1F' }}>
                                                    🛡️ {selectedAction.defenseSchema.toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Tasto Chiudi */}
                                    <TouchableOpacity
                                        onPress={() => setSelectedAction(null)}
                                        style={{
                                            backgroundColor: theme.colors.primary || '#003057',
                                            paddingVertical: 11,
                                            borderRadius: 10,
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>Chiudi</Text>
                                    </TouchableOpacity>
                                </>
                            );
                        })()}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Modale Dettaglio e Modifica Posizione Pull */}
            <Modal
                visible={!!selectedPull}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setSelectedPull(null);
                    setIsEditingPull(false);
                    setTempPullCoord(null);
                }}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 16
                    }}
                    activeOpacity={1}
                    onPress={() => {
                        setSelectedPull(null);
                        setIsEditingPull(false);
                        setTempPullCoord(null);
                    }}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 440,
                            backgroundColor: theme.colors.card,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                            padding: 16,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 10,
                            elevation: 10
                        }}
                    >
                        {selectedPull && (() => {
                            const isOur = selectedPull.team === 'us';
                            const currentCoord = tempPullCoord || selectedPull.coord;
                            const zoneText = pullZone(currentCoord) || 'In campo';
                            const ob = isOB(currentCoord);

                            const modalDots: FieldDot[] = [];
                            if (isEditingPull && tempPullCoord) {
                                modalDots.push({
                                    x: selectedPull.coord.x,
                                    y: selectedPull.coord.y,
                                    c: '#94A3B8',
                                    r: 1.0,
                                    label: 'PREC',
                                });
                                modalDots.push({
                                    x: tempPullCoord.x,
                                    y: tempPullCoord.y,
                                    c: '#22C55E',
                                    r: 1.4,
                                    label: 'NUOVO',
                                });
                            } else {
                                modalDots.push({
                                    x: selectedPull.coord.x,
                                    y: selectedPull.coord.y,
                                    c: isOur ? '#003057' : '#E07A1F',
                                    r: 1.3,
                                    label: isOur ? 'PULL' : 'LORO',
                                });
                            }

                            return (
                                <View style={{ gap: 12 }}>
                                    {/* Header Modale */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{
                                            backgroundColor: isOur ? '#003057' : '#E07A1F',
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 8
                                        }}>
                                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                                                🚀 {isOur ? 'PULL NOSTRO' : 'PULL AVVERSARIO'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedPull(null);
                                                setIsEditingPull(false);
                                                setTempPullCoord(null);
                                            }}
                                            style={{
                                                padding: 6,
                                                backgroundColor: theme.dark ? '#334155' : '#E2E8F0',
                                                borderRadius: 20,
                                                width: 28,
                                                height: 28,
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Scheda Dati Pull */}
                                    <View style={{
                                        backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC',
                                        borderRadius: 10,
                                        padding: 10,
                                        borderWidth: 1,
                                        borderColor: theme.dark ? '#334155' : '#E2E8F0',
                                        gap: 6
                                    }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Meta associata:</Text>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>Meta #{selectedPull.pointNumber}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Tiratore:</Text>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>{selectedPull.pullerName}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Zona atterraggio:</Text>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: ob ? '#EF4444' : '#22C55E' }}>
                                                {zoneText} {ob ? '(FUORI CAMPO)' : ''}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Coordinate:</Text>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }}>
                                                X: {currentCoord.x.toFixed(1)}m · Y: {currentCoord.y.toFixed(1)}m
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Istruzione per tocco sul campo */}
                                    {isEditingPull ? (
                                        <View style={{
                                            backgroundColor: '#22C55E18',
                                            borderColor: '#22C55E55',
                                            borderWidth: 1,
                                            borderRadius: 8,
                                            paddingVertical: 7,
                                            paddingHorizontal: 10,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8
                                        }}>
                                            <Text style={{ fontSize: 14 }}>📍</Text>
                                            <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#16A34A', flex: 1 }}>
                                                Tocca sul campo per spostare il pull, poi conferma.
                                            </Text>
                                        </View>
                                    ) : null}

                                    {/* Campo per anteprima / modifica interattiva */}
                                    <View style={{
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                        borderWidth: 1,
                                        borderColor: isEditingPull ? '#22C55E' : theme.colors.border
                                    }}>
                                        <InteractiveField
                                            dots={modalDots}
                                            interactive={isEditingPull}
                                            isPlayMode={false}
                                            flip={toFieldFlip}
                                            height={isMobile ? 170 : 210}
                                            enlargeable={false}
                                            onFieldPress={newCoord => {
                                                if (isEditingPull) {
                                                    setTempPullCoord(newCoord);
                                                }
                                            }}
                                        />
                                    </View>

                                    {/* Pulsanti Azione */}
                                    <View style={{ gap: 8, marginTop: 4 }}>
                                        {isEditingPull ? (
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setIsEditingPull(false);
                                                        setTempPullCoord(null);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        paddingVertical: 10,
                                                        borderRadius: 8,
                                                        backgroundColor: theme.dark ? '#334155' : '#E2E8F0',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>Annulla</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    disabled={!tempPullCoord || isSavingPull}
                                                    onPress={async () => {
                                                        if (!tempPullCoord || !onUpdatePullCoord) return;
                                                        setIsSavingPull(true);
                                                        try {
                                                            await onUpdatePullCoord(selectedPull.eventIndex, tempPullCoord);
                                                            setSelectedPull(null);
                                                            setIsEditingPull(false);
                                                            setTempPullCoord(null);
                                                        } finally {
                                                            setIsSavingPull(false);
                                                        }
                                                    }}
                                                    style={{
                                                        flex: 2,
                                                        paddingVertical: 10,
                                                        borderRadius: 8,
                                                        backgroundColor: tempPullCoord ? '#22C55E' : '#94A3B8',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                                                        {isSavingPull ? 'Salvataggio...' : 'Conferma Nuova Posizione'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                {canEdit !== false && onUpdatePullCoord && (
                                                    <TouchableOpacity
                                                        onPress={() => setIsEditingPull(true)}
                                                        style={{
                                                            flex: 2,
                                                            paddingVertical: 10,
                                                            borderRadius: 8,
                                                            backgroundColor: '#003057',
                                                            alignItems: 'center',
                                                            flexDirection: 'row',
                                                            justifyContent: 'center',
                                                            gap: 6
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 14 }}>✏️</Text>
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                                                            Modifica Posizione
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}

                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setSelectedPull(null);
                                                        setIsEditingPull(false);
                                                        setTempPullCoord(null);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        paddingVertical: 10,
                                                        borderRadius: 8,
                                                        backgroundColor: theme.dark ? '#334155' : '#E2E8F0',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>Chiudi</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })()}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Modale Scheda Dettaglio Giocatore */}
            <PlayerDetailModal
                visible={!!selectedPlayerId}
                playerId={selectedPlayerId}
                onClose={() => setSelectedPlayerId(null)}
                pStats={pStats}
                points={st.points}
                P={P}
                opponentName={match.opponent}
                isMobile={isMobile}
            />

            {/* Cronologia Interattiva Partita Point-by-Point */}
            <MatchTimelineCard
                points={st.points}
                rawEvents={match.events}
                P={P}
                opponentName={match.opponent}
                isMobile={isMobile}
            />
        </ScrollView>
    );
}
