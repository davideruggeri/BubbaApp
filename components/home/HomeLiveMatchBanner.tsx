import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { MatchAnalysis } from '../../services/firestore';
import { homeStyles as styles } from './homeStyles';

interface HomeLiveMatchBannerProps {
    liveMatch: MatchAnalysis;
    fadeAnim: Animated.Value;
    theme: any;
    onPress: () => void;
}

export const HomeLiveMatchBanner: React.FC<HomeLiveMatchBannerProps> = ({
    liveMatch,
    fadeAnim,
    theme,
    onPress,
}) => {
    return (
        <TouchableOpacity
            style={[styles.liveBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.danger }]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <View style={styles.liveHeader}>
                <Animated.View
                    style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: 'red',
                        marginRight: 8,
                        opacity: fadeAnim,
                    }}
                />
                <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 16 }}>PARTITA LIVE</Text>
            </View>
            <Text style={[styles.liveMatchTitle, { color: theme.colors.text }]}>
                Bubba vs {liveMatch.opponent}
            </Text>
            <Text style={[styles.liveScore, { color: theme.colors.text }]}>
                {liveMatch.ourScore} - {liveMatch.theirScore}
            </Text>
            <Text style={{ color: theme.colors.primary, marginTop: 5, fontWeight: 'bold' }}>
                Segui la diretta &gt;
            </Text>
        </TouchableOpacity>
    );
};
