import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { MatchAnalysis } from '../../services/firestore/types';
import { derive } from '../../utils/statsEngine';
import { exportAndDownloadXLSX } from '../../utils/matchExporter';
import { tournamentDetailStyles as styles } from './tournamentDetailStyles';

interface TournamentMatchCardProps {
    item: MatchAnalysis;
    playerMap: Record<string, { name: string; g: 'M' | 'F' }>;
    isStaff: boolean;
    theme: any;
    onPressMatch: (match: MatchAnalysis) => void;
    onEditTouches: (match: MatchAnalysis) => void;
    onEditDate: (match: MatchAnalysis) => void;
    onDeleteMatch: (id: string) => void;
}

const LivePulseBadge = () => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(fadeAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.liveIndicator}>
            <Animated.View style={[styles.liveDot, { opacity: fadeAnim }]} />
            <Text style={styles.liveText}>LIVE</Text>
        </View>
    );
};

const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

export const TournamentMatchCard: React.FC<TournamentMatchCardProps> = ({
    item,
    playerMap,
    isStaff,
    theme,
    onPressMatch,
    onEditTouches,
    onEditDate,
    onDeleteMatch,
}) => {
    const isLive = item.status === 'live';
    const derived = item.events && item.events.length ? derive(item) : null;
    const ourScore = derived ? derived.score.us : item.ourScore || 0;
    const theirScore = derived ? derived.score.them : item.theirScore || 0;

    return (
        <View style={[styles.matchCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <TouchableOpacity
                style={styles.cardContent}
                activeOpacity={0.8}
                onPress={() => onPressMatch(item)}
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
                        onPress={() => onEditTouches(item)}
                    >
                        <Text style={{ color: '#E07A1F', fontWeight: '600' }}>🥏 Tocchi</Text>
                    </TouchableOpacity>
                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => onEditDate(item)}
                    >
                        <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>📅 Data</Text>
                    </TouchableOpacity>
                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => exportAndDownloadXLSX([item], playerMap)}
                    >
                        <Text style={{ color: '#2E8540', fontWeight: '600' }}>📊 Excel Partita</Text>
                    </TouchableOpacity>
                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => onDeleteMatch(item.id)}
                    >
                        <Text style={{ color: theme.colors.danger, fontWeight: '600' }}>Elimina</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};
