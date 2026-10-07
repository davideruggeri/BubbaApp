import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { HallOfFameEntry } from '../../services/firestore';
import { homeStyles as styles } from './homeStyles';

interface HomeRecentTournamentsCardProps {
    recentTournaments: HallOfFameEntry[];
    theme: any;
    onPress: () => void;
    onFindEgg: () => void;
}

const getPlacementColor = (placement: string) => {
    const p = placement.trim();
    if (p === '1') return '#FFD700';
    if (p === '2') return '#C0C0C0';
    if (p === '3') return '#CD7F32';
    return '#333';
};

export const HomeRecentTournamentsCard: React.FC<HomeRecentTournamentsCardProps> = ({
    recentTournaments,
    theme,
    onPress,
    onFindEgg,
}) => {
    return (
        <TouchableOpacity
            style={[styles.sectionContainer, { backgroundColor: theme.colors.sectionBackground }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <TouchableOpacity activeOpacity={1} onPress={onFindEgg}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                    🏅 Ultimi Tornei 🏅
                </Text>
            </TouchableOpacity>
            {recentTournaments.map(t => (
                <View key={t.id} style={[styles.tournamentCard, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.tournamentTitle, { color: theme.colors.text }]}>{t.title}</Text>
                    <Text style={[styles.tournamentPlacement, { color: getPlacementColor(t.placement) }]}>
                        {t.placement}
                    </Text>
                    {t.awards && t.awards.length > 0 && (
                        <Text style={[styles.tournamentAwards, { color: theme.colors.textSecondary }]}>
                            {t.awards.join(', ')}
                        </Text>
                    )}
                </View>
            ))}
        </TouchableOpacity>
    );
};
