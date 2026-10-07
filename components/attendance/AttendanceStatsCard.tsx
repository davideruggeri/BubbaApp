import React from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { TrainingStats } from '../../services/firestore';
import { attendanceStyles as styles } from './attendanceStyles';

interface AttendanceStatsCardProps {
    stats: TrainingStats | null;
    theme: any;
}

export const AttendanceStatsCard: React.FC<AttendanceStatsCardProps> = ({ stats, theme }) => {
    if (!stats) return null;

    return (
        <View style={styles.statsContainer}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.statsScroll}
                contentContainerStyle={{ paddingHorizontal: 5, paddingBottom: 10 }}
            >
                <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                        {stats.averageAttendance}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                        Media Presenze
                    </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                        {stats.totalTrainings}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                        Allenamenti
                    </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.colors.card }]}>
                    <View style={styles.statRow}>
                        <Image source={require('../../assets/crown.png')} style={styles.crownIcon} />
                        <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                            {stats.recordAttendance?.count || 0}
                        </Text>
                    </View>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                        {stats.recordAttendance?.date
                            ? new Date(stats.recordAttendance.date).toLocaleDateString('it-IT', {
                                  day: 'numeric',
                                  month: 'long',
                              })
                            : '-'}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};
