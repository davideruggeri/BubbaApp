import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import { MatchPoint, MatchPlayer, MatchEvent } from '../services/firestore';
import { useTheme } from '../context/ThemeContext';

interface PointDetailModalProps {
    visible: boolean;
    onClose: () => void;
    point: MatchPoint | null;
    players: MatchPlayer[];
    previousScore: { our: number, their: number };
}

const PointDetailModal: React.FC<PointDetailModalProps> = ({ visible, onClose, point, players, previousScore }) => {
    const { theme } = useTheme();

    if (!point) return null;

    const getPlayerName = (id: string) => {
        const player = players.find(p => p.id === id);
        return player ? player.name : 'Squadra Avversaria';
    };

    const getEventLabel = (type: string) => {
        switch (type) {
            case 'D': return 'Difesa';
            case 'T': return 'Turnover';
            case 'drop': return 'Turnover (Drop)';
            default: return type;
        }
    };

    const scorer = point.scoredBy ? getPlayerName(point.scoredBy) : null;
    const assister = point.assistBy ? getPlayerName(point.assistBy) : null;

    // Determine who scored based on score difference
    // If point.ourScore > previousScore.our -> We scored
    // If point.theirScore > previousScore.their -> They scored
    const weScored = point.ourScore > previousScore.our;
    const isBreak = (weScored && point.type === 'defense') || (!weScored && point.type === 'offense');

    // Find the last turnover event if we conceded
    const lastTurnover = !weScored && point.events ? [...point.events].reverse().find(e => e.type === 'T' || (e.type as string) === 'drop') : null;
    const turnoverPlayer = lastTurnover ? getPlayerName(lastTurnover.playerId) : null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Dettaglio Punto</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Image
                                source={require('../assets/x.png')}
                                style={styles.closeIcon}
                            />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        {/* Score Header */}
                        <View style={styles.scoreContainer}>
                            <Text style={[styles.scoreText, { color: theme.colors.text }]}>
                                {point.ourScore} - {point.theirScore}
                            </Text>
                            {isBreak && (
                                <View style={styles.breakBadge}>
                                    <Text style={styles.breakText}>BREAK</Text>
                                </View>
                            )}
                        </View>

                        {/* Starting Possession */}
                        <View style={[styles.section, { borderBottomColor: theme.colors.border }]}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Partenza</Text>
                            <Text style={[styles.value, { color: theme.colors.text }]}>
                                {point.type === 'offense' ? 'Attacco Nostro' : 'Difesa (Attacco Avversario)'}
                            </Text>
                        </View>

                        {/* Events */}
                        <View style={[styles.section, { borderBottomColor: theme.colors.border }]}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 8 }]}>Eventi</Text>
                            {point.events && point.events.length > 0 ? (
                                point.events.map((event, index) => (
                                    <View key={index} style={styles.eventRow}>
                                        <Text style={[styles.eventTime, { color: theme.colors.textSecondary }]}>
                                            {/* Timestamp could be formatted if needed, for now just order */}
                                            #{index + 1}
                                        </Text>
                                        <Text style={[styles.eventDescription, { color: theme.colors.text }]}>
                                            <Text style={{ fontWeight: 'bold' }}>{getEventLabel(event.type)}</Text>
                                            {' - '}
                                            {getPlayerName(event.playerId)}
                                        </Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={{ color: theme.colors.textSecondary, fontStyle: 'italic' }}>Nessun evento registrato</Text>
                            )}
                        </View>

                        {/* Outcome */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Esito</Text>
                            {weScored ? (
                                <View>
                                    <Text style={[styles.outcomeText, { color: theme.colors.primary, fontWeight: 'bold' }]}>META BUBBA</Text>
                                    <Text style={[styles.value, { color: theme.colors.text }]}>
                                        Meta: {scorer || 'N/A'}
                                    </Text>
                                    {assister && (
                                        <Text style={[styles.value, { color: theme.colors.text }]}>
                                            Assist: {assister}
                                        </Text>
                                    )}
                                </View>
                            ) : (
                                <View>
                                    <Text style={[styles.outcomeText, { color: theme.colors.danger, fontWeight: 'bold' }]}>META SUBITA</Text>
                                    {turnoverPlayer && (
                                        <Text style={[styles.value, { color: theme.colors.text }]}>
                                            Turnover: {turnoverPlayer}
                                        </Text>
                                    )}
                                </View>
                            )}
                        </View>

                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeIcon: {
        width: 24,
        height: 24,
    },
    content: {
        marginBottom: 20,
    },
    scoreContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    scoreText: {
        fontSize: 36,
        fontWeight: 'bold',
    },
    breakBadge: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginTop: 5,
    },
    breakText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#333',
    },
    section: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee', // Default, overridden by theme
    },
    label: {
        fontSize: 12,
        textTransform: 'uppercase',
        marginBottom: 5,
    },
    value: {
        fontSize: 16,
    },
    eventRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    eventTime: {
        width: 30,
        fontSize: 12,
        marginRight: 10,
    },
    eventDescription: {
        fontSize: 14,
    },
    outcomeText: {
        fontSize: 18,
        marginBottom: 5,
    }
});

export default PointDetailModal;
