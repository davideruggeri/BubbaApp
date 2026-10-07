import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { homeStyles as styles } from './homeStyles';

interface HomeWrappedBannerProps {
    season: string;
    onPress: () => void;
}

export const HomeWrappedBanner: React.FC<HomeWrappedBannerProps> = ({ season, onPress }) => {
    return (
        <TouchableOpacity
            style={[styles.wrappedBanner, { borderColor: '#FF007F' }]}
            onPress={onPress}
            activeOpacity={0.88}
        >
            <View style={styles.wrappedBannerLeft}>
                <View style={styles.wrappedIconCircle}>
                    <Text style={{ fontSize: 28 }}>🎁</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.wrappedBadge}>RECAP STAGIONALE</Text>
                        <Text style={styles.wrappedSeasonText}>{season}</Text>
                    </View>
                    <Text style={styles.wrappedBannerTitle}>Il tuo Bubba Wrapped è pronto!</Text>
                    <Text style={styles.wrappedBannerSub}>
                        Rivivi presenze, streak da record, league e trasferte dell&apos;anno 🎉
                    </Text>
                </View>
            </View>
            <View style={styles.wrappedBannerAction}>
                <Text style={styles.wrappedActionText}>Guarda le Storie ›</Text>
            </View>
        </TouchableOpacity>
    );
};
