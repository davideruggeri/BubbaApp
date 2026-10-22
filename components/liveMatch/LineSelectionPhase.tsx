// components/liveMatch/LineSelectionPhase.tsx
// Componente per la selezione della linea (5 in campo) e impostazione O/D prima di ogni punto

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { styles } from './liveMatchStyles';
import { useTheme } from '../../context/ThemeContext';
import { MatchRosterPlayer } from '../../services/firestore';
import { ratioLabel, emptyPS } from '../../utils/statsEngine';

interface LineSelectionPhaseProps {
    ptsN: number;
    needRatio: 'F' | 'M';
    isStaff: boolean;
    canEdit: boolean;
    startOffense: boolean;
    onSetLineStartO: (val: boolean) => void;
    onFlipRatio: () => void;
    halfTimeDone?: boolean;
    onTriggerHalfTime: () => void;
    lastEventIsHalfTime?: boolean;
    matchRoster: MatchRosterPlayer[];
    lineSel: string[];
    onTogglePlayerInLine: (playerId: string) => void;
    onSetLineSel: (line: string[]) => void;
    pStats: Record<string, any>;
    isMobile: boolean;
    fCountInSel: number;
    mCountInSel: number;
    isGenderRatioOk: boolean;
    lastPt: any;
    lastO: any;
    lastD: any;
    onStartPoint: (line: string[], startOffense: boolean) => void;
    onOpenRosterModal: () => void;
    onUndo?: () => void;
    hasEvents?: boolean;
}

export default function LineSelectionPhase({
    ptsN,
    needRatio,
    isStaff,
    canEdit,
    startOffense,
    onSetLineStartO,
    onFlipRatio,
    halfTimeDone,
    onTriggerHalfTime,
    lastEventIsHalfTime,
    matchRoster,
    lineSel,
    onTogglePlayerInLine,
    onSetLineSel,
    pStats,
    isMobile,
    fCountInSel,
    mCountInSel,
    isGenderRatioOk,
    lastPt,
    lastO,
    lastD,
    onStartPoint,
    onOpenRosterModal,
    onUndo,
    hasEvents,
}: LineSelectionPhaseProps) {
    const { theme } = useTheme();

    return (
        <View style={styles.phaseContainer}>
            {/* Banner Regola ABBA */}
            <View style={[styles.ratioBanner, { backgroundColor: needRatio === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                <View>
                    <Text style={styles.ratioSub}>PUNTO {ptsN}</Text>
                    <Text style={styles.ratioMain}>{ratioLabel(needRatio)}</Text>
                </View>
                {isStaff && (
                    <TouchableOpacity style={styles.ratioFlipBtn} onPress={onFlipRatio}>
                        <Text style={styles.ratioFlipText}>⇄ Inverti</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Card Selezione Linea */}
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.rowBetween}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Punto {ptsN} — Scegli Linea</Text>
                    {isStaff && (
                        <View style={styles.segment}>
                            <TouchableOpacity
                                style={[styles.segBtn, startOffense && styles.segBtnOn]}
                                onPress={() => onSetLineStartO(true)}
                            >
                                <Text style={[styles.segText, startOffense && styles.segTextOn]}>Attacco</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segBtn, !startOffense && styles.segBtnOn]}
                                onPress={() => onSetLineStartO(false)}
                            >
                                <Text style={[styles.segText, !startOffense && styles.segTextOn]}>Difesa</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6, flexWrap: 'wrap', gap: 6 }}>
                    <Text style={[styles.muted, { color: theme.colors.textSecondary, flex: 1, minWidth: 140 }]}>
                        {startOffense ? 'Loro battono il pull, noi riceviamo.' : 'Facciamo noi il pull.'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {canEdit && !halfTimeDone && (
                            <TouchableOpacity
                                style={styles.halfTimeBtn}
                                onPress={onTriggerHalfTime}
                            >
                                <Text style={styles.halfTimeBtnText}>⏱️ Half Time</Text>
                            </TouchableOpacity>
                        )}
                        {halfTimeDone && (
                            <View style={styles.halfTimeBadge}>
                                <Text style={styles.halfTimeBadgeText}>🏁 2° TEMPO</Text>
                            </View>
                        )}
                        {canEdit && (
                            <TouchableOpacity
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderRadius: 8,
                                    backgroundColor: theme.colors.primary + '18',
                                    borderWidth: 1,
                                    borderColor: theme.colors.primary,
                                }}
                                onPress={onOpenRosterModal}
                            >
                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.primary }}>
                                    👥 Convocati ({matchRoster.length})
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {lastEventIsHalfTime && (
                    <View style={styles.halfTimeNotice}>
                        <Text style={styles.halfTimeNoticeText}>
                            ⏱️ Half Time attivato: ruoli invertiti rispetto all'avvio della partita!
                        </Text>
                    </View>
                )}

                {/* Griglia Giocatori Roster */}
                <View style={styles.playerGrid}>
                    {matchRoster.map(p => {
                        const isSel = lineSel.includes(p.id);
                        const ps = pStats[p.id] || emptyPS();
                        return (
                            <TouchableOpacity
                                key={p.id}
                                style={[
                                    styles.pbtn,
                                    isMobile ? styles.pbtnMobile : styles.pbtnDesktop,
                                    isSel && styles.pbtnSel,
                                    {
                                        backgroundColor: isSel
                                            ? (theme.dark ? '#1E3A5F' : '#E3ECF5')
                                            : theme.colors.card,
                                        borderColor: isSel
                                            ? (theme.dark ? '#38BDF8' : '#003057')
                                            : theme.colors.border,
                                    }
                                ]}
                                onPress={() => {
                                    if (!canEdit) return;
                                    onTogglePlayerInLine(p.id);
                                }}
                            >
                                <View style={{ paddingRight: 24, flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.pbtnName,
                                            { color: isSel && !theme.dark ? '#003057' : theme.colors.text }
                                        ]}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {p.name}
                                    </Text>
                                </View>
                                <View style={[styles.genderBadge, { backgroundColor: p.g === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                                    <Text style={styles.genderText}>{p.g}</Text>
                                </View>
                                <Text
                                    style={[
                                        styles.pbtnSub,
                                        { color: isSel ? (theme.dark ? '#93C5FD' : '#003057') : (theme.dark ? '#94A3B8' : '#777') }
                                    ]}
                                    numberOfLines={1}
                                >
                                    {ps.pts} pt ({ps.ptsO}O / {ps.ptsD}D)
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Badge di conteggio e validazione */}
                <View style={styles.lineBar}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                        <View
                            style={[
                                styles.chip,
                                { backgroundColor: lineSel.length === 5 && isGenderRatioOk ? '#C0D725' : '#FFE1E1' }
                            ]}
                        >
                            <Text style={styles.chipText}>
                                {lineSel.length}/5 · {fCountInSel}F {mCountInSel}M
                            </Text>
                        </View>
                        {canEdit && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6 }}>
                                {lastPt && (
                                    <TouchableOpacity
                                        style={styles.lineUtilBtn}
                                        onPress={() => onSetLineSel(lastPt.line.slice())}
                                    >
                                        <Text style={styles.lineUtilText}>Precedente</Text>
                                    </TouchableOpacity>
                                )}
                                {lastO && (
                                    <TouchableOpacity
                                        style={styles.lineUtilBtn}
                                        onPress={() => onSetLineSel(lastO.line.slice())}
                                    >
                                        <Text style={styles.lineUtilText}>Ultima O</Text>
                                    </TouchableOpacity>
                                )}
                                {lastD && (
                                    <TouchableOpacity
                                        style={styles.lineUtilBtn}
                                        onPress={() => onSetLineSel(lastD.line.slice())}
                                    >
                                        <Text style={styles.lineUtilText}>Ultima D</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity style={styles.lineUtilBtn} onPress={() => onSetLineSel([])}>
                                    <Text style={styles.lineUtilText}>Svuota</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>

                    {canEdit && (
                        <TouchableOpacity
                            style={[
                                styles.startPtBtn,
                                isMobile && styles.startPtBtnMobile,
                                { opacity: lineSel.length === 5 && isGenderRatioOk ? 1 : 0.4 }
                            ]}
                            disabled={lineSel.length !== 5 || !isGenderRatioOk}
                            onPress={() => onStartPoint(lineSel.slice(), startOffense)}
                        >
                            <Text style={styles.startPtText}>Avvia Punto ▸</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Annulla ultimo punto */}
                {canEdit && onUndo && hasEvents && (
                    <TouchableOpacity
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: '#94A3B8',
                            backgroundColor: 'transparent',
                            marginTop: 10,
                        }}
                        onPress={onUndo}
                        activeOpacity={0.7}
                    >
                        <Text style={{ fontSize: 18 }}>↩</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#5B6570' }}>Annulla ultima azione</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
