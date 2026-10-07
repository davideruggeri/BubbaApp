import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { styles } from './liveMatchStyles';
import { useTheme } from '../../context/ThemeContext';
import InteractiveField, { FieldDot } from '../InteractiveField';
import { MatchAnalysis } from '../../services/firestore';
import { pullZone, isOB } from '../../utils/statsEngine';
import { PullDetailModalData } from './matchStatsTypes';

interface PullMapCardProps {
    st: any;
    match: MatchAnalysis;
    P: (id: string) => { name: string; g: 'M' | 'F' };
    isMobile: boolean;
    canEdit?: boolean;
    onUpdatePullCoord?: (eventIndex: number, newCoord: { x: number; y: number }) => Promise<void>;
}

export const PullMapCard: React.FC<PullMapCardProps> = ({
    st,
    match,
    P,
    isMobile,
    canEdit = false,
    onUpdatePullCoord,
}) => {
    const { theme } = useTheme();

    const [statsFilter, setStatsFilter] = useState<string>('all');
    const [selectedPull, setSelectedPull] = useState<PullDetailModalData | null>(null);
    const [isEditingPull, setIsEditingPull] = useState<boolean>(false);
    const [tempPullCoord, setTempPullCoord] = useState<{ x: number; y: number } | null>(null);
    const [isSavingPull, setIsSavingPull] = useState<boolean>(false);

    // Calcolo dots pull
    const pullDots: FieldDot[] = [];
    let totalPulls = 0;
    let usPulls = 0;
    let themPulls = 0;

    for (const pt of st.points || []) {
        const pl = pt.pull;
        if (!pl || pl.x == null || pl.y == null) continue;
        totalPulls++;
        if (pl.team === 'us') usPulls++;
        else themPulls++;

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
                    const evIdx = (match.events || []).findIndex(
                        e => e === pl || (e.k === 'pull' && e.t === pl.t)
                    );
                    setSelectedPull({
                        eventIndex: evIdx,
                        pointNumber: pt.n,
                        pullEvent: pl,
                        pullerName: pl.p
                            ? P(pl.p).name
                            : pl.team === 'us'
                            ? 'Bubba'
                            : match.opponent || 'Avversari',
                        team: pl.team as 'us' | 'them',
                        coord: { x: pl.x!, y: pl.y! },
                    });
                    setIsEditingPull(false);
                    setTempPullCoord(null);
                },
            });
        }
    }

    return (
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
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginVertical: 10,
                    flexWrap: 'wrap',
                    gap: 8,
                }}
            >
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {[
                        { key: 'all', label: `Tutti (${totalPulls})` },
                        { key: 'us', label: `Nostri (${usPulls})` },
                        { key: 'them', label: `Loro (${themPulls})` },
                    ].map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[
                                styles.filterChip,
                                statsFilter === f.key
                                    ? styles.filterChipOn
                                    : {
                                          backgroundColor: theme.dark ? '#1E293B' : '#F1F5F9',
                                          borderColor: theme.dark ? '#334155' : '#CBD5E1',
                                      },
                            ]}
                            onPress={() => setStatsFilter(f.key)}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    statsFilter === f.key
                                        ? styles.filterChipTextOn
                                        : { color: theme.colors.text },
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

            <InteractiveField dots={pullDots} interactive={false} isPlayMode={false} />

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
                        padding: 16,
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
                            elevation: 10,
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
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View
                                            style={{
                                                backgroundColor: isOur ? '#003057' : '#E07A1F',
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 8,
                                            }}
                                        >
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
                                            padding: 10,
                                            borderWidth: 1,
                                            borderColor: theme.dark ? '#334155' : '#E2E8F0',
                                            gap: 6,
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Meta associata:</Text>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>
                                                Meta #{selectedPull.pointNumber}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Tiratore:</Text>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>
                                                {selectedPull.pullerName}
                                            </Text>
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

                                    {isEditingPull && (
                                        <View
                                            style={{
                                                backgroundColor: '#22C55E18',
                                                borderColor: '#22C55E55',
                                                borderWidth: 1,
                                                borderRadius: 8,
                                                paddingVertical: 7,
                                                paddingHorizontal: 10,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}
                                        >
                                            <Text style={{ fontSize: 14 }}>📍</Text>
                                            <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#16A34A', flex: 1 }}>
                                                Tocca sul campo per spostare il pull, poi conferma.
                                            </Text>
                                        </View>
                                    )}

                                    <View
                                        style={{
                                            borderRadius: 8,
                                            overflow: 'hidden',
                                            borderWidth: 1,
                                            borderColor: isEditingPull ? '#22C55E' : theme.colors.border,
                                        }}
                                    >
                                        <InteractiveField
                                            dots={modalDots}
                                            interactive={isEditingPull}
                                            isPlayMode={false}
                                            height={isMobile ? 170 : 210}
                                            enlargeable={false}
                                            onFieldPress={newCoord => {
                                                if (isEditingPull) {
                                                    setTempPullCoord(newCoord);
                                                }
                                            }}
                                        />
                                    </View>

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
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>
                                                        Annulla
                                                    </Text>
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
                                                        alignItems: 'center',
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
                                                            gap: 6,
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
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>
                                                        Chiudi
                                                    </Text>
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
        </View>
    );
};
