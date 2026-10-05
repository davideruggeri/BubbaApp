import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { MatchAnalysis } from '../services/firestore/types';
import { playerStats } from '../utils/statsEngine';

type EditTouchesModalProps = {
    visible: boolean;
    onClose: () => void;
    match: MatchAnalysis | null;
    playerMap: Record<string, { name: string; g: 'M' | 'F' }>;
    onSave: (manualTouches: Record<string, number>) => Promise<void>;
};

export default function EditTouchesModal({
    visible,
    onClose,
    match,
    playerMap,
    onSave
}: EditTouchesModalProps) {
    const { theme } = useTheme();
    const [touchesState, setTouchesState] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Pre-carica i tocchi correnti quando la modale si apre
    useEffect(() => {
        if (!match || !visible) return;

        // Calcola i tocchi da eventi senza manualTouches
        const rawStats = playerStats([{ pullFirst: match.pullFirst, events: match.events }]);
        const currentManual = match.manualTouches || {};

        const initial: Record<string, number> = {};
        // Se ci sono manualTouches, usa quelli, altrimenti il valore degli eventi
        for (const [id, count] of Object.entries(currentManual)) {
            initial[id] = count;
        }

        // Se un giocatore della partita non è in manualTouches, pre-popola con i tocchi calcolati
        const rosterIds = match.customRoster?.map(p => p.id) || Object.keys(rawStats);
        for (const id of rosterIds) {
            if (initial[id] === undefined) {
                initial[id] = rawStats[id]?.touches || 0;
            }
        }

        setTouchesState(initial);
        setSearchQuery('');
    }, [match, visible]);

    const playerList = useMemo(() => {
        if (!match) return [];
        // Roster prioritario: customRoster salvato o giocatori con statistiche
        const ids = new Set<string>();
        if (match.customRoster && match.customRoster.length > 0) {
            match.customRoster.forEach(p => ids.add(p.id));
        } else {
            const rawStats = playerStats([{ pullFirst: match.pullFirst, events: match.events }]);
            Object.keys(rawStats).forEach(id => ids.add(id));
        }
        if (match.manualTouches) {
            Object.keys(match.manualTouches).forEach(id => ids.add(id));
        }

        const list = Array.from(ids).map(id => {
            const pInfo = playerMap[id];
            const customP = match.customRoster?.find(x => x.id === id);
            return {
                id,
                name: pInfo?.name || customP?.name || id,
                g: pInfo?.g || customP?.g || 'M' as const
            };
        });

        // Ordinamento per sesso (F prima) e nome
        list.sort((a, b) => (a.g === 'F' ? 0 : 1) - (b.g === 'F' ? 0 : 1) || a.name.localeCompare(b.name));
        return list;
    }, [match, playerMap]);

    const filteredPlayers = useMemo(() => {
        if (!searchQuery.trim()) return playerList;
        const q = searchQuery.toLowerCase();
        return playerList.filter(p => p.name.toLowerCase().includes(q));
    }, [playerList, searchQuery]);

    const handleUpdate = (id: string, delta: number) => {
        setTouchesState(prev => {
            const cur = prev[id] ?? 0;
            const updated = Math.max(0, cur + delta);
            return { ...prev, [id]: updated };
        });
    };

    const handleSetDirect = (id: string, text: string) => {
        const val = parseInt(text.replace(/[^0-9]/g, ''), 10);
        setTouchesState(prev => ({
            ...prev,
            [id]: isNaN(val) ? 0 : Math.max(0, val)
        }));
    };

    const handleResetToAuto = () => {
        if (!match) return;
        const rawStats = playerStats([{ pullFirst: match.pullFirst, events: match.events }]);
        const resetMap: Record<string, number> = {};
        for (const p of playerList) {
            resetMap[p.id] = rawStats[p.id]?.touches || 0;
        }
        setTouchesState(resetMap);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(touchesState);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!visible || !match) return null;

    const totalTouches = Object.values(touchesState).reduce((a, b) => a + b, 0);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: theme.colors.text }]}>
                                🥏 Modifica Tocchi Partita
                            </Text>
                            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                                vs {match.opponent} · Totale squadra: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{totalTouches}</Text>
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Text style={[styles.closeBtnText, { color: theme.colors.textSecondary }]}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Barra di ricerca rapida */}
                    {playerList.length > 8 && (
                        <TextInput
                            style={[
                                styles.searchInput,
                                {
                                    backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC',
                                    borderColor: theme.colors.border,
                                    color: theme.colors.text
                                }
                            ]}
                            placeholder="Cerca giocatore..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    )}

                    {/* Lista Giocatori */}
                    <ScrollView style={styles.playerScroll} showsVerticalScrollIndicator={true}>
                        <View style={styles.playerList}>
                            {filteredPlayers.map(p => {
                                const count = touchesState[p.id] ?? 0;
                                return (
                                    <View
                                        key={p.id}
                                        style={[
                                            styles.playerRow,
                                            {
                                                borderColor: theme.colors.border,
                                                backgroundColor: count > 0 ? (theme.dark ? '#1B382B22' : '#F0FDF4') : 'transparent'
                                            }
                                        ]}
                                    >
                                        <View style={styles.playerInfo}>
                                            <View style={[styles.genderBadge, { backgroundColor: p.g === 'F' ? '#B8338A' : '#1F6FD1' }]}>
                                                <Text style={styles.genderText}>{p.g}</Text>
                                            </View>
                                            <Text style={[styles.playerName, { color: theme.colors.text }]} numberOfLines={1}>
                                                {p.name}
                                            </Text>
                                        </View>

                                        {/* Stepper Controls */}
                                        <View style={styles.controls}>
                                            <TouchableOpacity
                                                style={[styles.stepBtn, { backgroundColor: theme.dark ? '#334155' : '#E2E8F0' }]}
                                                onPress={() => handleUpdate(p.id, -1)}
                                            >
                                                <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>−</Text>
                                            </TouchableOpacity>

                                            <TextInput
                                                style={[
                                                    styles.countInput,
                                                    {
                                                        backgroundColor: theme.dark ? '#1E293B' : '#fff',
                                                        borderColor: theme.colors.border,
                                                        color: count > 0 ? theme.colors.primary : theme.colors.text
                                                    }
                                                ]}
                                                keyboardType="numeric"
                                                value={String(count)}
                                                onChangeText={txt => handleSetDirect(p.id, txt)}
                                                selectTextOnFocus
                                            />

                                            <TouchableOpacity
                                                style={[styles.stepBtn, { backgroundColor: theme.dark ? '#334155' : '#E2E8F0' }]}
                                                onPress={() => handleUpdate(p.id, 1)}
                                            >
                                                <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* Azioni Footer */}
                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                        <TouchableOpacity style={styles.resetBtn} onPress={handleResetToAuto}>
                            <Text style={styles.resetBtnText}>↺ Ricalcola da Eventi</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                style={[styles.cancelBtn, { borderColor: theme.colors.border }]}
                                onPress={onClose}
                                disabled={saving}
                            >
                                <Text style={[styles.cancelBtnText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: '#2E8540' }]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Salva Tocchi</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 520,
        maxHeight: '85%',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    closeBtn: {
        padding: 4,
        marginLeft: 8,
    },
    closeBtnText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    searchInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 7,
        fontSize: 13,
        marginBottom: 10,
    },
    playerScroll: {
        maxHeight: 380,
    },
    playerList: {
        gap: 6,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    genderBadge: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 8,
    },
    genderText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    playerName: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    stepBtn: {
        width: 30,
        height: 30,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    countInput: {
        width: 44,
        height: 30,
        borderWidth: 1,
        borderRadius: 6,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: 'bold',
        padding: 0,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        flexWrap: 'wrap',
        gap: 8,
    },
    resetBtn: {
        paddingVertical: 6,
    },
    resetBtnText: {
        fontSize: 12,
        color: '#E07A1F',
        fontWeight: '600',
    },
    cancelBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    cancelBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
    saveBtn: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
    },
});
