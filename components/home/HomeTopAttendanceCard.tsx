import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Member, RankedItem } from '../../services/firestore';
import { homeStyles as styles } from './homeStyles';

interface HomeTopAttendanceCardProps {
    topMembers: RankedItem<Member>[];
    stagioneCorrente: string;
    theme: any;
    onPress: () => void;
    onFindEgg: () => void;
}

export const HomeTopAttendanceCard: React.FC<HomeTopAttendanceCardProps> = ({
    topMembers,
    stagioneCorrente,
    theme,
    onPress,
    onFindEgg,
}) => {
    const renderMember = ({ item }: { item: RankedItem<Member> }) => (
        <View style={[styles.memberCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.rank, { color: theme.colors.primary }]}>
                {item.badge ? `${item.badge}\n#${item.rank}` : `#${item.rank}`}
            </Text>
            <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: theme.colors.text }]}>
                    {item.nickname ? item.nickname : `${item.firstName} ${item.lastName}`}
                    {item.jerseyNumber ? (
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>
                            {' '}
                            #{item.jerseyNumber}
                        </Text>
                    ) : (
                        ''
                    )}
                </Text>
                <Text style={[styles.attendanceCount, { color: theme.colors.textSecondary }]}>
                    {item.attendanceCount} presenze
                </Text>
            </View>
        </View>
    );

    return (
        <TouchableOpacity
            style={[styles.sectionContainer, { backgroundColor: theme.colors.sectionBackground }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <TouchableOpacity activeOpacity={1} onPress={onFindEgg}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                    🏆 Top 3 Presenze 🏆{'\n'}
                    <Text style={[styles.seasonTitleSmall, { color: theme.colors.textSecondary }]}>
                        ({stagioneCorrente})
                    </Text>
                </Text>
            </TouchableOpacity>
            <FlatList
                data={topMembers}
                renderItem={renderMember}
                keyExtractor={item => item.id}
                scrollEnabled={false}
            />
        </TouchableOpacity>
    );
};
