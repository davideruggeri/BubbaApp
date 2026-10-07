import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Member } from '../../services/firestore';
import { homeStyles as styles } from './homeStyles';

interface HomeLeagueCardProps {
    title: string;
    standings: { member: Member; points: number }[];
    theme: any;
    onPress: () => void;
}

export const HomeLeagueCard: React.FC<HomeLeagueCardProps> = ({
    title,
    standings,
    theme,
    onPress,
}) => {
    return (
        <TouchableOpacity
            style={[styles.sectionContainer, { backgroundColor: theme.colors.sectionBackground }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>{title}</Text>
            <FlatList
                data={standings}
                renderItem={({ item, index }) => (
                    <View style={[styles.memberCard, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.rank, { color: theme.colors.primary }]}>#{index + 1}</Text>
                        <View style={styles.memberInfo}>
                            <Text style={[styles.memberName, { color: theme.colors.text }]}>
                                {item.member.nickname
                                    ? item.member.nickname
                                    : `${item.member.firstName} ${item.member.lastName}`}
                                {item.member.jerseyNumber ? (
                                    <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
                                        {' '}
                                        #{item.member.jerseyNumber}
                                    </Text>
                                ) : (
                                    ''
                                )}
                            </Text>
                            <Text style={[styles.attendanceCount, { color: theme.colors.textSecondary }]}>
                                {item.points} punti
                            </Text>
                        </View>
                    </View>
                )}
                keyExtractor={item => item.member.id}
                scrollEnabled={false}
            />
        </TouchableOpacity>
    );
};
