// components/liveMatch/PlayerDetailModal.tsx
// Modale dettagliata con statistiche individuali, cronologia mete giocate e mappa azioni sul campo del giocatore

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import InteractiveField, { FieldDot, FieldTrajectory } from '../InteractiveField';

interface PlayerDetailModalProps {
    visible: boolean;
    playerId: string | null;
    onClose: () => void;
    pStats: Record<string, any>;
    points: any[];
    P: (id: string) => { name: string; g: 'M' | 'F' };
    opponentName: string;
    isMobile: boolean;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
    visible,
    playerId,
    onClose,
    pStats,
    points,
    P,
    opponentName,
    isMobile,
}) => {
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState<'points' | 'map'>('points');
    const [selectedDotInfo, setSelectedDotInfo] = useState<string | null>(null);

    if (!visible || !playerId) return null;

    const player = P(playerId);
    const ps = pStats[playerId] || {
        pts: 0,
        ptsO: 0,
        ptsD: 0,
        goals: 0,
        ast: 0,
        ds: 0,
        toTot: 0,
        toThrow: 0,
        toDrop: 0,
        toStall: 0,
        toOther: 0,
        touches: 0,
        plusMinus: 0,
    };

    // Punti in cui il giocatore era in campo
    const playedPoints: any[] = [];
    let curUs = 0;
    let curThem = 0;

    for (let i = 0; i < (points || []).length; i++) {
        const pt = points[i];
        if (!pt || !pt.result) continue;

        if (pt.result === 'us') curUs++;
        else if (pt.result === 'them') curThem++;

        if (pt.line && pt.line.includes(playerId)) {
            // Estrazione azioni del giocatore in questo punto
            const playerActions: { kind: string; desc: string; color: string }[] = [];
            let touchesInPt = 0;

            for (const e of (pt.ev || [])) {
                if (e.k === 'touch' && e.p === playerId) touchesInPt++;
                if (e.k === 'goal' && e.s === playerId) {
                    touchesInPt++;
                    playerActions.push({
                        kind: 'goal',
                        desc: e.a ? `⚽ Meta segnata (Assist di ${P(e.a).name})` : '⚽ Meta segnata',
                        color: '#2E8540'
                    });
                }
                if (e.k === 'goal' && e.a === playerId) {
                    playerActions.push({
                        kind: 'assist',
                        desc: `🎯 Assist per ${P(e.s).name}`,
                        color: '#1F6FD1'
                    });
                }
                if (e.k === 'call' && e.p === playerId) {
                    playerActions.push({
                        kind: 'callahan',
                        desc: '⭐ Callahan effettuato!',
                        color: '#7A5AA8'
                    });
                }
                if (e.k === 'd' && e.p === playerId) {
                    playerActions.push({
                        kind: 'defense',
                        desc: '🛡️ Difesa / Intercetto',
                        color: '#2E8540'
                    });
                }
                if (e.k === 'tt' && e.p === playerId) {
                    playerActions.push({
                        kind: 'tt',
                        desc: '❌ Errore di lancio (TO)',
                        color: '#C8323C'
                    });
                }
                if (e.k === 'td' && e.p === playerId) {
                    playerActions.push({
                        kind: 'td',
                        desc: '❌ Errore di presa (Drop)',
                        color: '#C8323C'
                    });
                }
                if (e.k === 'ts' && e.p === playerId) {
                    playerActions.push({
                        kind: 'ts',
                        desc: '⏱️ Stall out subito',
                        color: '#9E2A31'
                    });
                }
            }

            // Tipo esito punto
            let outcomeLabel = '';
            let outcomeColor = '';
            if (pt.o) {
                if (pt.result === 'us') {
                    outcomeLabel = pt.toUs === 0 ? 'Meta fatta (Clean)' : 'Meta fatta';
                    outcomeColor = '#2E8540';
                } else {
                    outcomeLabel = 'Meta subita (Break)';
                    outcomeColor = '#C8323C';
                }
            } else {
                if (pt.result === 'us') {
                    outcomeLabel = '⚡ Meta fatta (Break)';
                    outcomeColor = '#1F6FD1';
                } else {
                    outcomeLabel = 'Meta subita';
                    outcomeColor = '#E07A1F';
                }
            }

            const toUs = pt.toUs ?? 0;
            const toThem = pt.toThem ?? 0;
            const dsetEvents = (pt.ev || []).filter((e: any) => e.k === 'dset' && e.v).map((e: any) => e.v);
            const defenseScheme = dsetEvents.length > 0 ? Array.from(new Set(dsetEvents)).join(', ') : null;
            const hasDefensePhase = !pt.o || toUs > 0 || (pt.ev || []).some((e: any) => e.k === 'd' || e.k === 'err' || e.k === 'tg' || e.k === 'dset');

            playedPoints.push({
                ptIndex: i + 1,
                pt,
                scoreUs: curUs,
                scoreThem: curThem,
                outcomeLabel,
                outcomeColor,
                playerActions,
                touchesInPt,
                toUs,
                toThem,
                hasDefensePhase,
                defenseScheme,
                teammates: pt.line.filter((id: string) => id !== playerId).map((id: string) => P(id).name),
            });
        }
    }

    // Calcolo efficienza squadra con giocatore in campo
    const totalWon = playedPoints.filter(p => p.pt.result === 'us').length;
    const winRate = playedPoints.length > 0 ? Math.round((totalWon / playedPoints.length) * 100) : 0;

    // Estrazione punti e traiettorie per la mappa personale del giocatore
    const dots: FieldDot[] = [];
    const trajectories: FieldTrajectory[] = [];

    for (const pItem of playedPoints) {
        for (const e of (pItem.pt.ev || [])) {
            const isDefense = (e.k === 'd' || e.k === 'call') && e.p === playerId;
            const isThrowTO = e.k === 'tt' && e.p === playerId;
            const isCatchTO = e.k === 'td' && e.p === playerId;
            const isStallTO = e.k === 'ts' && e.p === playerId;

            if (isDefense) {
                if (e.x != null && e.y != null) {
                    const infoText = `Meta #${pItem.ptIndex}: Difesa / Intercetto effettuato`;
                    dots.push({
                        x: e.x,
                        y: e.y,
                        c: '#2E8540',
                        r: 0.8,
                        label: `${pItem.ptIndex}`,
                        onPress: () => setSelectedDotInfo(infoText),
                    });
                }
            } else if (isThrowTO || isCatchTO || isStallTO) {
                const toColor = '#C8323C';
                const label = isThrowTO ? 'Errore di lancio' : isCatchTO ? 'Errore di presa' : 'Stall Out';
                const infoText = `Meta #${pItem.ptIndex}: ${label}`;

                if (e.trajectory && e.trajectory.length >= 2) {
                    trajectories.push({
                        points: e.trajectory,
                        color: toColor,
                        label: `Meta #${pItem.ptIndex}`,
                        onPress: () => setSelectedDotInfo(infoText),
                    });
                    const dotPoint = isThrowTO ? e.trajectory[0] : e.trajectory[e.trajectory.length - 1];
                    dots.push({
                        x: dotPoint.x,
                        y: dotPoint.y,
                        c: toColor,
                        r: 0.8,
                        label: `${pItem.ptIndex}`,
                        onPress: () => setSelectedDotInfo(infoText),
                    });
                } else if (e.x != null && e.y != null) {
                    dots.push({
                        x: e.x,
                        y: e.y,
                        c: toColor,
                        r: 0.8,
                        label: `${pItem.ptIndex}`,
                        onPress: () => setSelectedDotInfo(infoText),
                    });
                }
            }
        }
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={e => e.stopPropagation()}
                    style={[styles.modalBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                >
                    {/* Header del Giocatore */}
                    <View style={styles.headerRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View style={[styles.avatarCircle, { backgroundColor: player.g === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                                <Text style={styles.avatarText}>{player.name ? player.name.charAt(0).toUpperCase() : '?'}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text style={[styles.playerName, { color: theme.colors.text }]} numberOfLines={1}>
                                        {player.name}
                                    </Text>
                                    <View style={[styles.genderTag, { backgroundColor: player.g === 'F' ? '#B8338A22' : '#1F6FD122' }]}>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: player.g === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                            {player.g === 'F' ? 'Femminile' : 'Maschile'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 }}>
                                    {ps.pts} mete giocate su {points.filter(p => p.result).length} totali ({winRate}% mete vinte in campo)
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.dark ? '#334155' : '#E2E8F0' }]}>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Griglia KPI Giocatore */}
                    <View style={styles.kpiContainer}>
                        <View style={[styles.kpiItem, { backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9' }]}>
                            <Text style={[styles.kpiVal, { color: theme.colors.text }]}>{ps.pts}</Text>
                            <Text style={styles.kpiSub}>PT ({ps.ptsO}O / {ps.ptsD}D)</Text>
                        </View>
                        <View style={[styles.kpiItem, { backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9' }]}>
                            <Text style={[styles.kpiVal, { color: '#2E8540' }]}>{ps.goals}</Text>
                            <Text style={styles.kpiSub}>Mete</Text>
                        </View>
                        <View style={[styles.kpiItem, { backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9' }]}>
                            <Text style={[styles.kpiVal, { color: '#1F6FD1' }]}>{ps.ast}</Text>
                            <Text style={styles.kpiSub}>Assist</Text>
                        </View>
                        <View style={[styles.kpiItem, { backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9' }]}>
                            <Text style={[styles.kpiVal, { color: '#2E8540' }]}>{ps.ds}</Text>
                            <Text style={styles.kpiSub}>Difese</Text>
                        </View>
                        <View style={[styles.kpiItem, { backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9' }]}>
                            <Text style={[styles.kpiVal, { color: '#C8323C' }]}>{ps.toTot}</Text>
                            <Text style={styles.kpiSub}>TO ({ps.toThrow}L / {ps.toDrop}P)</Text>
                        </View>
                        <View style={[styles.kpiItem, { backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9' }]}>
                            <Text style={[styles.kpiVal, { color: '#E07A1F' }]}>{ps.touches || 0}</Text>
                            <Text style={styles.kpiSub}>Tocchi</Text>
                        </View>
                        <View style={[styles.kpiItem, { backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9' }]}>
                            <Text style={[styles.kpiVal, { color: ps.plusMinus >= 0 ? '#2E8540' : '#C8323C' }]}>
                                {ps.plusMinus > 0 ? `+${ps.plusMinus}` : ps.plusMinus}
                            </Text>
                            <Text style={styles.kpiSub}>+/- Rating</Text>
                        </View>
                    </View>

                    {/* Sub-tab: Cronologia Mete vs Mappa Azioni */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            onPress={() => setActiveTab('points')}
                            style={[
                                styles.tabBtn,
                                activeTab === 'points' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2.5 }
                            ]}
                        >
                            <Text style={[
                                styles.tabText,
                                { color: activeTab === 'points' ? theme.colors.primary : theme.colors.textSecondary, fontWeight: activeTab === 'points' ? '800' : '600' }
                            ]}>
                                📋 Cronologia Mete ({playedPoints.length})
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setActiveTab('map')}
                            style={[
                                styles.tabBtn,
                                activeTab === 'map' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2.5 }
                            ]}
                        >
                            <Text style={[
                                styles.tabText,
                                { color: activeTab === 'map' ? theme.colors.primary : theme.colors.textSecondary, fontWeight: activeTab === 'map' ? '800' : '600' }
                            ]}>
                                🗺️ Mappa Azioni ({dots.length + trajectories.length})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Contenuto Tab */}
                    {activeTab === 'points' ? (
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8, gap: 10 }}>
                            {playedPoints.length === 0 ? (
                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 20 }}>
                                    Il giocatore non è ancora sceso in campo in questa partita.
                                </Text>
                            ) : (
                                playedPoints.map((item, idx) => (
                                    <View
                                        key={`pt-${item.ptIndex}-${idx}`}
                                        style={[
                                            styles.pointCard,
                                            {
                                                backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC',
                                                borderColor: theme.dark ? '#334155' : '#E2E8F0'
                                            }
                                        ]}
                                    >
                                        {/* Header della meta */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.text }}>
                                                    Meta #{item.ptIndex}
                                                </Text>
                                                <View style={[
                                                    styles.roleBadge,
                                                    { backgroundColor: item.pt.o ? '#C8323C22' : '#1F6FD122' }
                                                ]}>
                                                    <Text style={{ fontSize: 10, fontWeight: '800', color: item.pt.o ? '#C8323C' : '#1F6FD1' }}>
                                                        {item.pt.o ? 'Attacco (O)' : 'Difesa (D)'}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.colors.text }}>
                                                    Bubba {item.scoreUs} - {item.scoreThem} {opponentName}
                                                </Text>
                                                <View style={[styles.outcomeBadge, { backgroundColor: item.outcomeColor + '22', borderColor: item.outcomeColor }]}>
                                                    <Text style={{ fontSize: 10, fontWeight: '800', color: item.outcomeColor }}>
                                                        {item.outcomeLabel}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Informazioni squadra nel punto (Turnover & Schema di Difesa) */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                            {/* Badge Turnover meta */}
                                            <View style={[
                                                styles.metaContextBadge,
                                                {
                                                    backgroundColor: item.toUs > 0 ? '#C8323C15' : '#2E854015',
                                                    borderColor: item.toUs > 0 ? '#C8323C40' : '#2E854040'
                                                }
                                            ]}>
                                                <Text style={{ fontSize: 10.5, fontWeight: '700', color: item.toUs > 0 ? '#C8323C' : '#2E8540' }}>
                                                    🔄 TO: {item.toUs} Bubba · {item.toThem} {opponentName || 'loro'}
                                                </Text>
                                            </View>

                                            {/* Badge Difesa / Schema utilizzato */}
                                            {item.hasDefensePhase ? (
                                                <View style={[
                                                    styles.metaContextBadge,
                                                    {
                                                        backgroundColor: item.defenseScheme ? '#E07A1F18' : '#1F6FD115',
                                                        borderColor: item.defenseScheme ? '#E07A1F55' : '#1F6FD144'
                                                    }
                                                ]}>
                                                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: item.defenseScheme ? '#E07A1F' : '#1F6FD1' }}>
                                                        🛡️ {item.defenseScheme ? `SCHEMA: ${item.defenseScheme.toUpperCase()}` : 'DIFESA GIOCATA (schema N/D)'}
                                                    </Text>
                                                </View>
                                            ) : (
                                                <View style={[
                                                    styles.metaContextBadge,
                                                    {
                                                        backgroundColor: theme.dark ? '#33415533' : '#E2E8F066',
                                                        borderColor: 'transparent'
                                                    }
                                                ]}>
                                                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: theme.colors.textSecondary }}>
                                                        🛡️ Nessuna difesa (attacco clean)
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Azioni individuali del giocatore nel punto */}
                                        <View style={{ marginTop: 6, gap: 4 }}>
                                            {item.playerActions.length > 0 ? (
                                                item.playerActions.map((act: any, aIdx: number) => (
                                                    <View key={`act-${aIdx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: act.color }}>
                                                            {act.desc}
                                                        </Text>
                                                    </View>
                                                ))
                                            ) : (
                                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                                                    In campo nel punto · Nessuna statistica individuale registrata
                                                </Text>
                                            )}

                                            {item.touchesInPt > 0 && (
                                                <Text style={{ fontSize: 11, color: '#E07A1F', fontWeight: '600' }}>
                                                    🥏 {item.touchesInPt} {item.touchesInPt === 1 ? 'tocco' : 'tocchi'} del disco in questa meta
                                                </Text>
                                            )}
                                        </View>

                                        {/* Compagni in campo */}
                                        <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 }}>
                                            👥 Con: {item.teammates.join(', ')}
                                        </Text>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    ) : (
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8, gap: 12 }}>
                            {/* Legenda della mappa */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#2E8540' }} />
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.text }}>
                                        Difese / Intercetti ({dots.filter(d => d.c === '#2E8540').length})
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#C8323C' }} />
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.text }}>
                                        Turnover / Errori ({dots.filter(d => d.c === '#C8323C').length + trajectories.length})
                                    </Text>
                                </View>
                            </View>

                            {/* Mini campo con le sole azioni del giocatore */}
                            <InteractiveField
                                dots={dots}
                                trajectories={trajectories}
                                interactive={false}
                                isPlayMode={true}
                                enlargeable={true}
                                height={isMobile ? 180 : 230}
                            />

                            {/* Dettaglio del punto/azione selezionato toccando la mappa */}
                            {selectedDotInfo && (
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: theme.dark ? '#334155' : '#CBD5E1',
                                }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>
                                        📍 {selectedDotInfo}
                                    </Text>
                                    <TouchableOpacity onPress={() => setSelectedDotInfo(null)} style={{ padding: 4 }}>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary }}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center' }}>
                                💡 Tocca un pallino o una freccia per visualizzare l'azione corrispondente
                            </Text>
                        </ScrollView>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 14,
    },
    modalBox: {
        width: '100%',
        maxWidth: 580,
        height: '88%',
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    avatarCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    playerName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    genderTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    kpiItem: {
        flex: 1,
        minWidth: 70,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    kpiVal: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    kpiSub: {
        fontSize: 9.5,
        color: '#718096',
        marginTop: 1,
        fontWeight: '600',
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        marginBottom: 6,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
    },
    tabText: {
        fontSize: 12,
    },
    pointCard: {
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
    },
    roleBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    outcomeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
    },
    metaContextBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
});

export default PlayerDetailModal;
