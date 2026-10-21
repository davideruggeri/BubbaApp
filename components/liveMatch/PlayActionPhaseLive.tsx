// components/liveMatch/PlayActionPhaseLive.tsx
// Modalità "bordo campo" — registrazione rapida senza traiettorie né tocchi singoli

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { styles } from './liveMatchStyles';
import { useTheme } from '../../context/ThemeContext';

type PendingLive = 'goal_s' | 'goal_a' | 'tt' | 'td' | 'ts' | 'd' | null;

interface Props {
    curPt: any;
    isOffense: boolean;
    st: any;
    canEdit: boolean;
    pending: boolean;
    pStats: Record<string, any>;
    P: (id: string) => { name: string; g: 'M' | 'F' };
    pushEvent: (event: any) => void;
    onChangeLine: () => void;
    onUndo?: () => void;
}

export default function PlayActionPhaseLive({
    curPt,
    isOffense,
    st,
    canEdit,
    pending,
    pStats,
    P,
    pushEvent,
    onChangeLine,
    onUndo,
}: Props) {
    const { theme } = useTheme();
    const [pendingAction, setPendingAction] = useState<PendingLive>(null);
    const [selectedScorer, setSelectedScorer] = useState<string | null>(null);

    const line: string[] = curPt?.line || [];
    const toUs = st?.toUs ?? 0;
    const toThem = st?.toThem ?? 0;

    const bannerBg = isOffense ? '#C0D725' : '#003057';
    const bannerText = isOffense ? '#1A2600' : '#FFFFFF';
    const phaseLabel = isOffense ? 'DISCO NOSTRO — ATTACCO' : 'DISCO LORO — DIFESA';

    function resetPending() {
        setPendingAction(null);
        setSelectedScorer(null);
    }

    function handlePlayerTap(playerId: string) {
        if (!canEdit || pending) return;

        if (pendingAction === 'goal_s') {
            setSelectedScorer(playerId);
            setPendingAction('goal_a');
            return;
        }
        if (pendingAction === 'goal_a') {
            pushEvent({ k: 'goal', team: 'us', p: selectedScorer, ast: playerId });
            resetPending();
            return;
        }
        if (pendingAction === 'tt') {
            pushEvent({ k: 'tt', p: playerId });
            resetPending();
            return;
        }
        if (pendingAction === 'td') {
            pushEvent({ k: 'td', p: playerId });
            resetPending();
            return;
        }
        if (pendingAction === 'ts') {
            pushEvent({ k: 'ts', p: playerId });
            resetPending();
            return;
        }
        if (pendingAction === 'd') {
            pushEvent({ k: 'd', p: playerId });
            resetPending();
            return;
        }
    }

    function handleNoAssist() {
        pushEvent({ k: 'goal', team: 'us', p: selectedScorer, ast: null });
        resetPending();
    }

    const pickerLabel: Record<string, string> = {
        goal_s: '⭐ Chi ha segnato?',
        goal_a: `⭐ Assist per ${selectedScorer ? P(selectedScorer).name : ''}?`,
        tt: '🥏 Chi ha fatto il TO lancio?',
        td: '🤲 Chi ha perso la presa?',
        ts: '⏱️ Stall — chi aveva il disco?',
        d: '🛡️ Chi ha fatto la difesa?',
    };

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, gap: 12 }]}>

            {/* Banner fase */}
            <View style={[styles.statusBanner, { backgroundColor: bannerBg }]}>
                <Text style={[styles.statusTitle, { color: bannerText }]}>{phaseLabel}</Text>
                <Text style={[styles.statusSub, { color: bannerText, opacity: 0.85 }]}>
                    TO nostri: {toUs} · TO loro: {toThem}
                </Text>
            </View>

            {/* Linea in campo */}
            <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary }}>
                        IN CAMPO ({line.length})
                    </Text>
                    {canEdit && (
                        <TouchableOpacity onPress={onChangeLine}>
                            <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '600' }}>✏️ Cambia</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {line.map(id => {
                        const pl = P(id);
                        const isScorer = selectedScorer === id;
                        return (
                            <View
                                key={id}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    backgroundColor: isScorer ? '#2E8540' : (theme.dark ? '#1E293B' : '#F1F5F9'),
                                    borderRadius: 16,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderWidth: 1,
                                    borderColor: isScorer ? '#2E8540' : theme.colors.border,
                                }}
                            >
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: pl.g === 'F' ? '#B8338A' : '#1F6FD1' }} />
                                <Text style={{ fontSize: 11, fontWeight: '600', color: isScorer ? '#fff' : theme.colors.text }}>
                                    {pl.name}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Picker giocatore inline */}
            {pendingAction && (
                <View style={{ backgroundColor: theme.dark ? '#0F172A' : '#EFF6FF', borderRadius: 10, padding: 12, borderWidth: 1.5, borderColor: '#3B82F6' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#3B82F6', marginBottom: 10 }}>
                        {pickerLabel[pendingAction]}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {line.map(id => {
                            const pl = P(id);
                            if (pendingAction === 'goal_a' && id === selectedScorer) return null;
                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        backgroundColor: theme.dark ? '#1E3A5F' : '#DBEAFE',
                                        borderWidth: 1.5,
                                        borderColor: '#3B82F6',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                    }}
                                    onPress={() => handlePlayerTap(id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: pl.g === 'F' ? '#B8338A' : '#1F6FD1' }} />
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.dark ? '#93C5FD' : '#1D4ED8' }}>
                                        {pl.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                        {pendingAction === 'goal_a' && (
                            <TouchableOpacity
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                    borderWidth: 1.5,
                                    borderColor: theme.colors.border,
                                }}
                                onPress={handleNoAssist}
                                activeOpacity={0.7}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary }}>
                                    Senza assist
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        style={{ marginTop: 10, alignSelf: 'flex-start' }}
                        onPress={resetPending}
                    >
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>✕ Annulla</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Bottoni azione */}
            {!pendingAction && canEdit && (
                <View style={{ gap: 8 }}>
                    {isOffense ? (
                        <>
                            <TouchableOpacity
                                style={[actionBtn, { backgroundColor: '#2E8540' }]}
                                onPress={() => setPendingAction('goal_s')}
                                activeOpacity={0.8}
                                disabled={pending}
                            >
                                <Text style={actionBtnText}>⭐  META!</Text>
                            </TouchableOpacity>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                    style={[actionBtn, { flex: 1, backgroundColor: '#C8323C' }]}
                                    onPress={() => setPendingAction('tt')}
                                    activeOpacity={0.8}
                                    disabled={pending}
                                >
                                    <Text style={actionBtnText}>🥏  TO Lancio</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[actionBtn, { flex: 1, backgroundColor: '#A3272F' }]}
                                    onPress={() => setPendingAction('td')}
                                    activeOpacity={0.8}
                                    disabled={pending}
                                >
                                    <Text style={actionBtnText}>🤲  TO Presa</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={[actionBtn, { backgroundColor: '#E07A1F' }]}
                                onPress={() => setPendingAction('ts')}
                                activeOpacity={0.8}
                                disabled={pending}
                            >
                                <Text style={actionBtnText}>⏱️  Stall Out</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[actionBtn, { backgroundColor: '#003057' }]}
                                onPress={() => setPendingAction('d')}
                                activeOpacity={0.8}
                                disabled={pending}
                            >
                                <Text style={actionBtnText}>🛡️  Difesa!</Text>
                            </TouchableOpacity>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                    style={[actionBtn, { flex: 1, backgroundColor: '#5B6570' }]}
                                    onPress={() => { pushEvent({ k: 'err' }); }}
                                    activeOpacity={0.8}
                                    disabled={pending}
                                >
                                    <Text style={actionBtnText}>⚡  Err. Loro</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[actionBtn, { flex: 1, backgroundColor: '#C8323C' }]}
                                    onPress={() => { pushEvent({ k: 'goal', team: 'them' }); }}
                                    activeOpacity={0.8}
                                    disabled={pending}
                                >
                                    <Text style={actionBtnText}>🔴  Meta Loro</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {/* Annulla ultima azione */}
                    {onUndo && (
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
                                marginTop: 4,
                            }}
                            onPress={onUndo}
                            activeOpacity={0.7}
                            disabled={pending}
                        >
                            <Text style={{ fontSize: 18 }}>↩</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#5B6570' }}>Annulla ultima azione</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

const actionBtn = {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
};

const actionBtnText = {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
};
