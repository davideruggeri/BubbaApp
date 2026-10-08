import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MatchAnalysis } from '../../services/firestore/types';

interface ReorderTournamentMatchesModalProps {
    visible: boolean;
    matches: MatchAnalysis[];
    theme: any;
    onClose: () => void;
    onSave: (orderedMatches: MatchAnalysis[]) => Promise<void>;
}

const formatDate = (dateString?: string) => {
    if (!dateString) return 'Senza data';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
};

export const ReorderTournamentMatchesModal: React.FC<ReorderTournamentMatchesModalProps> = ({
    visible,
    matches,
    theme,
    onClose,
    onSave,
}) => {
    const [items, setItems] = useState<MatchAnalysis[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) {
            setItems([...matches]);
        }
    }, [visible, matches]);

    const moveItem = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= items.length) return;
        const updated = [...items];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        setItems(updated);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(items);
        } finally {
            setSaving(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                        <View>
                            <Text style={[styles.title, { color: theme.colors.text }]}>
                                Riordina Partite del Torneo
                            </Text>
                            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                                Usa le frecce per impostare l'ordine delle partite
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.closeBtn, { backgroundColor: theme.dark ? '#334155' : '#E2E8F0' }]}
                            onPress={onClose}
                            disabled={saving}
                        >
                            <Text style={[styles.closeBtnText, { color: theme.colors.text }]}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content List */}
                    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                        {items.map((item, index) => {
                            const isFirst = index === 0;
                            const isLast = index === items.length - 1;

                            return (
                                <View
                                    key={item.id}
                                    style={[
                                        styles.itemRow,
                                        {
                                            backgroundColor: theme.dark ? '#1E293B' : '#FFFFFF',
                                            borderColor: theme.colors.border,
                                        },
                                    ]}
                                >
                                    {/* Ordine Index */}
                                    <View style={[styles.indexBadge, { backgroundColor: theme.dark ? '#334155' : '#EEF2F6' }]}>
                                        <Text style={[styles.indexText, { color: theme.colors.primary }]}>
                                            #{index + 1}
                                        </Text>
                                    </View>

                                    {/* Info Partita */}
                                    <View style={styles.itemInfo}>
                                        <Text style={[styles.opponentName, { color: theme.colors.text }]} numberOfLines={1}>
                                            vs {item.opponent || 'Avversario'}
                                        </Text>
                                        <View style={styles.itemMeta}>
                                            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                                                📅 {formatDate(item.date)}
                                            </Text>
                                            {item.ourScore != null && item.theirScore != null && (
                                                <Text style={[styles.metaScore, { color: theme.colors.text }]}>
                                                    · {item.ourScore} - {item.theirScore}
                                                </Text>
                                            )}
                                        </View>
                                    </View>

                                    {/* Controlli Spostamento */}
                                    <View style={styles.arrowsRow}>
                                        <TouchableOpacity
                                            style={[
                                                styles.arrowBtn,
                                                { backgroundColor: theme.dark ? '#334155' : '#F1F5F9' },
                                                isFirst && styles.arrowBtnDisabled,
                                            ]}
                                            disabled={isFirst || saving}
                                            onPress={() => moveItem(index, index - 1)}
                                        >
                                            <Text style={[styles.arrowText, { color: isFirst ? '#94A3B8' : theme.colors.text }]}>
                                                ▲
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.arrowBtn,
                                                { backgroundColor: theme.dark ? '#334155' : '#F1F5F9' },
                                                isLast && styles.arrowBtnDisabled,
                                            ]}
                                            disabled={isLast || saving}
                                            onPress={() => moveItem(index, index + 1)}
                                        >
                                            <Text style={[styles.arrowText, { color: isLast ? '#94A3B8' : theme.colors.text }]}>
                                                ▼
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}

                        {items.length === 0 && (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Text style={{ color: theme.colors.textSecondary }}>Nessuna partita presente.</Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
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
                            disabled={saving || items.length === 0}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.saveBtnText}>Salva Ordine ✓</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    container: {
        width: '100%',
        maxWidth: 540,
        maxHeight: '85%',
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    body: {
        flex: 1,
    },
    bodyContent: {
        padding: 16,
        gap: 8,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        gap: 12,
    },
    indexBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    indexText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    itemInfo: {
        flex: 1,
    },
    opponentName: {
        fontSize: 15,
        fontWeight: '700',
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
        gap: 6,
    },
    metaText: {
        fontSize: 12,
    },
    metaScore: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    arrowsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    arrowBtn: {
        width: 34,
        height: 34,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowBtnDisabled: {
        opacity: 0.35,
    },
    arrowText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 14,
        borderTopWidth: 1,
        gap: 10,
    },
    cancelBtn: {
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    cancelBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
    saveBtn: {
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 8,
        minWidth: 110,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
    },
});
