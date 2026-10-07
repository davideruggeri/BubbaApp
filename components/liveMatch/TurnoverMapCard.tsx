import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
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
}

export const TurnoverMapCard: React.FC<TurnoverMapCardProps> = ({ st, match, P }) => {
    const { theme } = useTheme();

    const [toStatsFilter, setToStatsFilter] = useState<'all' | 'toUs' | 'toThem'>('all');
    const [toOriginFilter, setToOriginFilter] = useState<'all' | 'O' | 'D'>('all');
    const [toFieldFlip, setToFieldFlip] = useState<boolean>(false);
    const [selectedAction, setSelectedAction] = useState<ActionDetailModalData | null>(null);

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
                    if (e.k === 'tt') {
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
                    data: actionData,
                });

                if (!isDefense && e.trajectory && e.trajectory.length >= 2) {
                    toTrajectories.push({
                        points: e.trajectory,
                        color,
                        label: pName,
                        onPress: () => setSelectedAction(actionData),
                        data: actionData,
                    });
                }
            }
        }
    }
    const totalLocEvents = toUsCount + toThemCount;

    return (
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
                                              f.key === 'O' ? '#C8323C' : f.key === 'D' ? '#1F6FD1' : '#003057',
                                          borderColor:
                                              f.key === 'O' ? '#A8252F' : f.key === 'D' ? '#1756A4' : '#003057',
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
                        padding: 16,
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
                            elevation: 10,
                        }}
                    >
                        {selectedAction && (() => {
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
                                            onPress={() => setSelectedAction(null)}
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
                                        <View>
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
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginTop: 2 }}>
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

                                    <TouchableOpacity
                                        onPress={() => setSelectedAction(null)}
                                        style={{
                                            backgroundColor: theme.colors.primary || '#003057',
                                            paddingVertical: 11,
                                            borderRadius: 10,
                                            alignItems: 'center',
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
        </View>
    );
};
