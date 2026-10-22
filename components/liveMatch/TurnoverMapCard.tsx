import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { styles } from './liveMatchStyles';
import { useTheme } from '../../context/ThemeContext';
import InteractiveField, { FieldDot, FieldTrajectory } from '../InteractiveField';
import { MatchAnalysis } from '../../services/firestore';
import { attRight } from '../../utils/statsEngine';
import { ActionDetailModalData } from './matchStatsTypes';

interface TurnoverMapCardProps {
    st: any;
    match: MatchAnalysis;
    P: (id: string) => { name: string; g: 'M' | 'F' };
    isMobile?: boolean;
    canEdit?: boolean;
    onUpdateTurnoverEvent?: (
        eventIndex: number,
        updatedFields: {
            k?: 'tt' | 'td' | 'ts' | 'tx' | 'd' | 'err' | 'call';
            p?: string | null;
            x?: number | null;
            y?: number | null;
            trajectory?: { x: number; y: number }[];
        }
    ) => Promise<void>;
}

export const TurnoverMapCard: React.FC<TurnoverMapCardProps> = ({
    st,
    match,
    P,
    isMobile = false,
    canEdit = false,
    onUpdateTurnoverEvent,
}) => {
    const { theme } = useTheme();

    const [toStatsFilter, setToStatsFilter] = useState<'all' | 'toUs' | 'toThem'>('all');
    const [toOriginFilter, setToOriginFilter] = useState<'all' | 'O' | 'D'>('all');
    const [toFieldFlip, setToFieldFlip] = useState<boolean>(false);
    const [selectedAction, setSelectedAction] = useState<ActionDetailModalData | null>(null);

    // Stato modifica errore
    const [isEditingAction, setIsEditingAction] = useState<boolean>(false);
    const [tempKind, setTempKind] = useState<string>('tt');
    const [tempPlayerId, setTempPlayerId] = useState<string | null>(null);
    const [tempTrajectory, setTempTrajectory] = useState<{ x: number; y: number }[] | null>(null);
    const [tempCoord, setTempCoord] = useState<{ x: number; y: number } | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const openActionModal = (actionData: ActionDetailModalData) => {
        setSelectedAction(actionData);
        setIsEditingAction(false);
        setTempKind(actionData.kind);
        setTempPlayerId(actionData.event?.p || null);
        setTempTrajectory(actionData.event?.trajectory || null);
        setTempCoord(
            actionData.event?.x != null && actionData.event?.y != null
                ? { x: actionData.event.x, y: actionData.event.y }
                : null
        );
    };

    const closeActionModal = () => {
        setSelectedAction(null);
        setIsEditingAction(false);
        setTempTrajectory(null);
        setTempCoord(null);
    };

    // Punti e Traiettorie Turnover & Difese
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
                const color = isDefense ? '#2E8540' : isThem ? '#E07A1F' : pt.o ? '#C8323C' : '#1F6FD1';
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
                    if (e.k === 'tt' || e.k === 'err') {
                        dotX = e.trajectory[0].x;
                        dotY = e.trajectory[0].y;
                    } else if (e.k === 'td') {
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
                        const firstTouch = pt.ev.find(
                            (item: any) => item.k === 'touch' && item.p && item.p !== e.p
                        );
                        if (firstTouch) throwerName = P(firstTouch.p).name;
                        else throwerName = 'Non registrato';
                    }
                } else if (e.k === 'd' || e.k === 'call') {
                    defenderName = e.p ? P(e.p).name : 'Senza giocatore';
                }

                const dsetEv = pt.ev.find((item: any) => item.k === 'dset');
                const defenseSchema = dsetEv ? dsetEv.v : undefined;

                const evIdxInMatch = (match.events || []).findIndex(
                    item => item === e || (item.k === e.k && item.t === e.t && item.p === e.p && item.x === e.x && item.y === e.y)
                );

                const actionData: ActionDetailModalData = {
                    event: e,
                    point: pt,
                    pointIndex: pt.n,
                    eventIndex: evIdxInMatch,
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
                    onPress: () => openActionModal(actionData),
                    data: actionData,
                });

                if (!isDefense && e.trajectory && e.trajectory.length >= 2) {
                    toTrajectories.push({
                        points: e.trajectory,
                        color,
                        label: pName,
                        onPress: () => openActionModal(actionData),
                        data: actionData,
                    });
                }
            }
        }
    }
    const totalLocEvents = toUsCount + toThemCount;

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View>
                <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 2 }]}>
                    Mappa Turnover & Difese
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                    Totale: {totalLocEvents} ({toUsCount} TO nostri · {toThemCount} TO avversari)
                </Text>
            </View>

            {/* Filtri e Legenda */}
            <View style={{ marginTop: 10, marginBottom: 8, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary }}>
                        Mete:
                    </Text>
                    {[
                        { key: 'all', label: `Tutte (${totalLocEvents})` },
                        { key: 'O', label: `⚡ Attacco (${oPointCount})` },
                        { key: 'D', label: `🛡️ Difesa (${dPointCount})` },
                    ].map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[
                                styles.filterChip,
                                toOriginFilter === f.key
                                    ? {
                                          backgroundColor:
                                              f.key === 'O' ? '#C8323C' : f.key === 'D' ? '#1F6FD1' : (theme.dark ? '#2563EB' : '#003057'),
                                          borderColor:
                                              f.key === 'O' ? '#A8252F' : f.key === 'D' ? '#1756A4' : (theme.dark ? '#60A5FA' : '#003057'),
                                      }
                                    : {
                                          backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                          borderColor: theme.dark ? '#334155' : '#CBD5E1',
                                      },
                            ]}
                            onPress={() => setToOriginFilter(f.key as any)}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    {
                                        color: toOriginFilter === f.key ? '#fff' : theme.colors.text,
                                        fontWeight: toOriginFilter === f.key ? 'bold' : '600',
                                    },
                                ]}
                            >
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                    }}
                >
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: 'Tutti' },
                            { key: 'toUs', label: `TO Nostri (${toUsCount})` },
                            { key: 'toThem', label: `TO Loro (${toThemCount})` },
                        ].map(f => (
                            <TouchableOpacity
                                key={f.key}
                                style={[
                                    styles.filterChip,
                                    toStatsFilter === f.key
                                        ? styles.filterChipOn
                                        : {
                                              backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                              borderColor: theme.dark ? '#334155' : '#CBD5E1',
                                          },
                                ]}
                                onPress={() => setToStatsFilter(f.key as any)}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        toStatsFilter === f.key
                                            ? styles.filterChipTextOn
                                            : { color: theme.colors.text },
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
                            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>
                                Nostri (O)
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#1F6FD1' }} />
                            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>
                                Nostri (D)
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#2E8540' }} />
                            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>
                                Difese (D)
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#E07A1F' }} />
                            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary }}>
                                Avversari
                            </Text>
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

            {/* Modal Dettaglio e Modifica Azione / Turnover / Difesa */}
            <Modal
                visible={!!selectedAction}
                transparent={true}
                animationType="fade"
                onRequestClose={closeActionModal}
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
                    onPress={closeActionModal}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={e => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: 440,
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
                        {selectedAction && (() => {
                            if (isEditingAction) {
                                const isTrajMode = tempKind === 'tt' || tempKind === 'td' || tempKind === 'err';
                                const pointLine = selectedAction.point?.line || [];
                                const rosterList: string[] = pointLine.length > 0
                                    ? pointLine
                                    : (match.customRoster?.map(r => r.id) || (match.players?.map((p: any) => p.id) || []));
                                const isAttRight = attRight(match, selectedAction.pointIndex, st.halfTimePoint);

                                return (
                                    <ScrollView showsVerticalScrollIndicator={false}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <View style={{ backgroundColor: '#003057', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                                                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                                                    ✏️ Modifica Errore / Azione
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => setIsEditingAction(false)}
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

                                        {/* Selezione Tipo Errore */}
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 }}>
                                            Tipo di Evento:
                                        </Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                                            {[
                                                { k: 'tt', label: '🥏 TO Lancio' },
                                                { k: 'td', label: '🤲 TO Presa' },
                                                { k: 'err', label: '⚠️ Errore Loro' },
                                                { k: 'd', label: '🛡️ Difesa' },
                                                { k: 'ts', label: '⏱️ Stall Out' },
                                            ].map(item => (
                                                <TouchableOpacity
                                                    key={item.k}
                                                    onPress={() => {
                                                        setTempKind(item.k);
                                                        if (item.k === 'err') setTempPlayerId(null);
                                                    }}
                                                    style={{
                                                        paddingHorizontal: 10,
                                                        paddingVertical: 6,
                                                        borderRadius: 8,
                                                        backgroundColor: tempKind === item.k ? (theme.dark ? '#2563EB' : '#003057') : (theme.dark ? '#1E293B' : '#F1F5F9'),
                                                        borderWidth: 1.5,
                                                        borderColor: tempKind === item.k ? (theme.dark ? '#60A5FA' : '#003057') : (theme.dark ? '#334155' : theme.colors.border),
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: tempKind === item.k ? 'bold' : '600',
                                                            color: tempKind === item.k ? '#fff' : theme.colors.text,
                                                        }}
                                                    >
                                                        {item.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {/* Selezione Giocatore (se non è errore avversario) */}
                                        {tempKind !== 'err' && (
                                            <View style={{ marginBottom: 14 }}>
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 }}>
                                                    {tempKind === 'd' ? 'Difensore:' : tempKind === 'td' ? 'Chi ha subito il drop:' : 'Giocatore coinvolto:'}
                                                </Text>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                                    <TouchableOpacity
                                                        onPress={() => setTempPlayerId(null)}
                                                        style={{
                                                            paddingHorizontal: 10,
                                                            paddingVertical: 6,
                                                            borderRadius: 8,
                                                            backgroundColor: tempPlayerId === null ? (theme.dark ? '#2563EB' : '#003057') : (theme.dark ? '#1E293B' : '#F1F5F9'),
                                                            borderWidth: 1.5,
                                                            borderColor: tempPlayerId === null ? (theme.dark ? '#60A5FA' : '#003057') : (theme.dark ? '#334155' : theme.colors.border),
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 11, color: tempPlayerId === null ? '#fff' : theme.colors.text, fontWeight: '600' }}>
                                                            Senza nome
                                                        </Text>
                                                    </TouchableOpacity>
                                                    {rosterList.map((pId: string) => {
                                                        const isSel = tempPlayerId === pId;
                                                        return (
                                                            <TouchableOpacity
                                                                key={pId}
                                                                onPress={() => setTempPlayerId(pId)}
                                                                style={{
                                                                    paddingHorizontal: 10,
                                                                    paddingVertical: 6,
                                                                    borderRadius: 8,
                                                                    backgroundColor: isSel ? (theme.dark ? '#2563EB' : '#003057') : (theme.dark ? '#1E293B' : '#F1F5F9'),
                                                                    borderWidth: 1.5,
                                                                    borderColor: isSel ? (theme.dark ? '#60A5FA' : '#003057') : (theme.dark ? '#334155' : theme.colors.border),
                                                                }}
                                                            >
                                                                <Text style={{ fontSize: 11, color: isSel ? '#fff' : theme.colors.text, fontWeight: '600' }}>
                                                                    {P(pId).name}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </ScrollView>
                                            </View>
                                        )}

                                        {/* Modifica Traiettoria / Coordinata su Campo */}
                                        <View style={{ marginBottom: 12 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary }}>
                                                    Posizione / Traiettoria:
                                                </Text>
                                                {tempTrajectory && (
                                                    <TouchableOpacity
                                                        onPress={() => setTempTrajectory(null)}
                                                        style={{ paddingVertical: 2, paddingHorizontal: 6, backgroundColor: '#E2E8F0', borderRadius: 4 }}
                                                    >
                                                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1E293B' }}>↺ Ridisegna</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <View
                                                style={{
                                                    borderRadius: 8,
                                                    overflow: 'hidden',
                                                    borderWidth: 1,
                                                    borderColor: '#22C55E',
                                                }}
                                            >
                                                <InteractiveField
                                                    dots={
                                                        tempCoord && (!tempTrajectory || tempTrajectory.length < 2)
                                                            ? [{ x: tempCoord.x, y: tempCoord.y, c: '#E07A1F', r: 1.2 }]
                                                            : []
                                                    }
                                                    trajectories={
                                                        tempTrajectory && tempTrajectory.length >= 2
                                                            ? [{ points: tempTrajectory, color: '#E07A1F' }]
                                                            : []
                                                    }
                                                    interactive={true}
                                                    drawTrajectoryMode={isTrajMode && !tempTrajectory}
                                                    drawingColor="#E07A1F"
                                                    isPlayMode={true}
                                                    height={isMobile ? 160 : 190}
                                                    enlargeable={false}
                                                    flip={!isAttRight}
                                                    onTrajectoryComplete={traj => {
                                                        setTempTrajectory(traj);
                                                        setTempCoord(null);
                                                    }}
                                                    onFieldPress={c => {
                                                        setTempCoord(c);
                                                        setTempTrajectory(null);
                                                    }}
                                                />
                                            </View>
                                            <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                                                {isTrajMode
                                                    ? 'Trascina sul campo per tracciare la linea oppure tocca per un punto singolo.'
                                                    : 'Tocca sul campo per impostare il punto.'}
                                            </Text>
                                        </View>

                                        {/* Bottoni Salva / Annulla */}
                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                            <TouchableOpacity
                                                onPress={() => setIsEditingAction(false)}
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
                                                disabled={isSaving}
                                                onPress={async () => {
                                                    if (!onUpdateTurnoverEvent || selectedAction.eventIndex == null) return;
                                                    setIsSaving(true);
                                                    try {
                                                        let finalX = tempCoord?.x ?? selectedAction.coordX ?? null;
                                                        let finalY = tempCoord?.y ?? selectedAction.coordY ?? null;
                                                        if (tempTrajectory && tempTrajectory.length >= 2) {
                                                            if (tempKind === 'tt' || tempKind === 'err') {
                                                                finalX = tempTrajectory[0].x;
                                                                finalY = tempTrajectory[0].y;
                                                            } else {
                                                                finalX = tempTrajectory[tempTrajectory.length - 1].x;
                                                                finalY = tempTrajectory[tempTrajectory.length - 1].y;
                                                            }
                                                        }
                                                        await onUpdateTurnoverEvent(selectedAction.eventIndex, {
                                                            k: tempKind as any,
                                                            p: tempPlayerId,
                                                            trajectory: tempTrajectory || undefined,
                                                            x: finalX,
                                                            y: finalY,
                                                        });
                                                        closeActionModal();
                                                    } finally {
                                                        setIsSaving(false);
                                                    }
                                                }}
                                                style={{
                                                    flex: 2,
                                                    paddingVertical: 10,
                                                    borderRadius: 8,
                                                    backgroundColor: '#22C55E',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                                                    {isSaving ? 'Salvataggio...' : 'Conferma Modifica ✓'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </ScrollView>
                                );
                            }

                            const isThrowTO = selectedAction.kind === 'tt';
                            const isCatchTO = selectedAction.kind === 'td';
                            const isStallTO = selectedAction.kind === 'ts';
                            const isDefense = selectedAction.kind === 'd';
                            const isCallahan = selectedAction.kind === 'call';
                            const isOppError = selectedAction.kind === 'err';

                            const headerColor = isDefense
                                ? '#2E8540'
                                : isCallahan
                                ? '#7A5AA8'
                                : isOppError
                                ? '#E07A1F'
                                : selectedAction.startType === 'O'
                                ? '#C8323C'
                                : '#1F6FD1';

                            const title = isThrowTO
                                ? 'ERRORE DI LANCIO'
                                : isCatchTO
                                ? 'ERRORE DI PRESA'
                                : isDefense
                                ? 'DIFESA EFFETTUATA'
                                : isCallahan
                                ? 'CALLAHAN'
                                : isStallTO
                                ? 'STALL OUT'
                                : isOppError
                                ? 'ERRORE AVVERSARIO'
                                : 'TURNOVER';

                            const icon = isThrowTO
                                ? '🥏❌'
                                : isCatchTO
                                ? '🤲❌'
                                : isDefense
                                ? '🛡️✓'
                                : isCallahan
                                ? '⭐🛡️'
                                : isStallTO
                                ? '⏱️'
                                : isOppError
                                ? '⚠️'
                                : '🥏';

                            return (
                                <>
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: 14,
                                        }}
                                    >
                                        <View
                                            style={{
                                                backgroundColor: headerColor,
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 8,
                                            }}
                                        >
                                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                                                {icon} {title}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={closeActionModal}
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

                                    <View
                                        style={{
                                            backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC',
                                            borderRadius: 10,
                                            padding: 12,
                                            marginBottom: 14,
                                            borderWidth: 1,
                                            borderColor: theme.dark ? '#334155' : '#E2E8F0',
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: '600',
                                                    color: theme.colors.textSecondary,
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                Punto #{selectedAction.pointIndex}
                                            </Text>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginTop: 2 }} numberOfLines={1}>
                                                Bubba {selectedAction.scoreUs} - {selectedAction.scoreThem} {match.opponent}
                                            </Text>
                                        </View>
                                        <View
                                            style={{
                                                paddingHorizontal: 10,
                                                paddingVertical: 5,
                                                borderRadius: 8,
                                                backgroundColor: selectedAction.startType === 'O' ? '#C8323C22' : '#1F6FD122',
                                                borderWidth: 1,
                                                borderColor: selectedAction.startType === 'O' ? '#C8323C' : '#1F6FD1',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: 'bold',
                                                    color: selectedAction.startType === 'O' ? '#C8323C' : '#1F6FD1',
                                                }}
                                            >
                                                {selectedAction.startType === 'O' ? '⚡ Inizio Attacco (O)' : '🛡️ Inizio Difesa (D)'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{ gap: 10, marginBottom: 16 }}>
                                        {selectedAction.throwerName && (
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    paddingVertical: 8,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: theme.colors.border,
                                                    flexWrap: 'wrap',
                                                    gap: 6,
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, flexShrink: 1 }}>
                                                    {isThrowTO ? 'Chi ha sbagliato il lancio:' : 'Chi ha fatto il passaggio:'}
                                                </Text>
                                                <Text
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 'bold',
                                                        color: theme.colors.text,
                                                        flexShrink: 1,
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    🥏 {selectedAction.throwerName}
                                                </Text>
                                            </View>
                                        )}

                                        {selectedAction.receiverName && (
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    paddingVertical: 8,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: theme.colors.border,
                                                    flexWrap: 'wrap',
                                                    gap: 6,
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, flexShrink: 1 }}>
                                                    Chi ha sbagliato a ricevere:
                                                </Text>
                                                <Text
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 'bold',
                                                        color: '#C8323C',
                                                        flexShrink: 1,
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    🤲 {selectedAction.receiverName}
                                                </Text>
                                            </View>
                                        )}

                                        {selectedAction.defenderName && (
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    paddingVertical: 8,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: theme.colors.border,
                                                    flexWrap: 'wrap',
                                                    gap: 6,
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, flexShrink: 1 }}>
                                                    Difesa effettuata da:
                                                </Text>
                                                <Text
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 'bold',
                                                        color: '#2E8540',
                                                        flexShrink: 1,
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    🛡️ {selectedAction.defenderName}
                                                </Text>
                                            </View>
                                        )}

                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                paddingVertical: 8,
                                                borderBottomWidth: 1,
                                                borderBottomColor: theme.colors.border,
                                            }}
                                        >
                                            <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                                                Meta di attacco Bubba:
                                            </Text>
                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                                🚩 Meta a {selectedAction.targetEndzone}
                                            </Text>
                                        </View>

                                        {selectedAction.defenseSchema && (
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    paddingVertical: 8,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: theme.colors.border,
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                                                    Schema difensivo attivo:
                                                </Text>
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#E07A1F' }}>
                                                    🛡️ {selectedAction.defenseSchema.toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                        {canEdit !== false && onUpdateTurnoverEvent && selectedAction.eventIndex != null && selectedAction.eventIndex >= 0 && (
                                            <TouchableOpacity
                                                onPress={() => setIsEditingAction(true)}
                                                style={{
                                                    flex: 2,
                                                    paddingVertical: 11,
                                                    borderRadius: 10,
                                                    backgroundColor: theme.dark ? '#2563EB' : '#003057',
                                                    alignItems: 'center',
                                                    flexDirection: 'row',
                                                    justifyContent: 'center',
                                                    gap: 6,
                                                }}
                                            >
                                                <Text style={{ fontSize: 14 }}>✏️</Text>
                                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                                                    Modifica Errore
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            onPress={closeActionModal}
                                            style={{
                                                flex: 1,
                                                backgroundColor: theme.dark ? '#334155' : '#E2E8F0',
                                                paddingVertical: 11,
                                                borderRadius: 10,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: 'bold' }}>Chiudi</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            );
                        })()}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};
