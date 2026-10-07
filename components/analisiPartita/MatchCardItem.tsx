import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { MatchAnalysis } from '../../services/firestore';
import { derive } from '../../utils/statsEngine';
import { formatDate } from './analisiPartitaUtils';
import { analisiPartitaStyles as styles } from './analisiPartitaStyles';
import { useTheme } from '../../context/ThemeContext';

interface MatchCardItemProps {
    item: MatchAnalysis;
    isStaff: boolean;
    onOpen: (match: MatchAnalysis) => void;
    onExportXLSX: (match: MatchAnalysis) => void;
    onEdit: (match: MatchAnalysis) => void;
    onDelete: (id: string) => void;
}

export const LivePulseBadge: React.FC = () => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(fadeAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, [fadeAnim]);

    return (
        <View style={styles.liveIndicator}>
            <Animated.View style={[styles.liveDot, { opacity: fadeAnim }]} />
            <Text style={styles.liveText}>LIVE</Text>
        </View>
    );
};

export const MatchCardItem: React.FC<MatchCardItemProps> = ({
    item,
    isStaff,
    onOpen,
    onExportXLSX,
    onEdit,
    onDelete
}) => {
    const { theme } = useTheme();
    const isLive = item.status === 'live';

    const derived = useMemo(() => {
        if (item.events && item.events.length) {
            return derive(item);
        }
        return null;
    }, [item]);

    const ourScore = derived ? derived.score.us : (item.ourScore || 0);
    const theirScore = derived ? derived.score.them : (item.theirScore || 0);

    return (
        <View style={[styles.matchCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <TouchableOpacity
                style={styles.cardContent}
                activeOpacity={0.8}
                onPress={() => onOpen(item)}
            >
                <View style={styles.matchHeader}>
                    <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
                        {formatDate(item.date)}
                    </Text>
                    {isLive ? (
                        <LivePulseBadge />
                    ) : (
                        <View style={styles.completedBadge}>
                            <Text style={styles.completedBadgeText}>Completata</Text>
                        </View>
                    )}
                </View>

                <View style={styles.matchBody}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[styles.opponentText, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                            Bubba vs {item.opponent}
                        </Text>
                        {item.eventName && (
                            <Text style={[styles.eventTag, { color: theme.colors.primary }]} numberOfLines={1} ellipsizeMode="tail">
                                🏆 {item.eventName}
                            </Text>
                        )}
                        <View style={styles.matchBadges}>
                            <Text style={[styles.detailBadge, { backgroundColor: item.surface === 'sabbia' ? '#ffe0b2' : '#c8e6c9' }]}>
                                {item.surface === 'sabbia' ? '🏖️ Sabbia' : '🌱 Erba'}
                            </Text>
                            <Text style={[styles.detailBadge, { backgroundColor: '#e3f2fd' }]}>
                                {item.firstRatio === 'F' ? '3F / 2M' : '3M / 2F'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.scoreContainer}>
                        <Text style={[styles.scoreText, { color: theme.colors.primary }]}>
                            {ourScore} - {theirScore}
                        </Text>
                        <Text style={styles.scoreSubText}>
                            {item.events?.length ? `${item.events.length} eventi` : '0 eventi'}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>

            {isStaff && (
                <View style={[styles.cardActions, { borderTopColor: theme.colors.border }]}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => onExportXLSX(item)}
                    >
                        <Text style={{ color: '#2E8540', fontWeight: '600' }}>📊 Excel</Text>
                    </TouchableOpacity>
                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                    <TouchableOpacity style={styles.actionButton} onPress={() => onEdit(item)}>
                        <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Modifica</Text>
                    </TouchableOpacity>
                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                    <TouchableOpacity style={styles.actionButton} onPress={() => onDelete(item.id)}>
                        <Text style={{ color: theme.colors.danger, fontWeight: '600' }}>Elimina</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};
