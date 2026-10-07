import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { StandingItem } from './leagueTypes';
import { leagueStyles as styles } from './leagueStyles';
import { useTheme } from '../../context/ThemeContext';

interface LeagueStandingsTabProps {
    standings: StandingItem[];
    onSelectMember: (memberId: string) => void;
}

export const LeagueStandingsTab: React.FC<LeagueStandingsTabProps> = ({
    standings,
    onSelectMember
}) => {
    const { theme } = useTheme();

    const renderStandingsRow = ({ item, index }: { item: StandingItem, index: number }) => (
        <TouchableOpacity
            style={[
                styles.row,
                index % 2 === 0 && { backgroundColor: theme.colors.sectionBackground },
                { borderBottomColor: theme.colors.border }
            ]}
            onPress={() => onSelectMember(item.member.id)}
        >
            <Text style={[styles.cell, styles.cellRank, { color: theme.colors.primary }]}>{item.rank}</Text>
            <Text style={[styles.cell, styles.cellTeam, { color: theme.colors.text }]}>
                {item.member.nickname || item.member.firstName}
                {item.member.jerseyNumber ? (
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}> #{item.member.jerseyNumber}</Text>
                ) : ''}
            </Text>
            <Text style={[styles.cell, styles.cellPoints, { color: theme.colors.text }]}>{item.points}</Text>
            <Text style={[styles.cell, { color: theme.colors.text }]}>
                {item.attendanceCountCampo}
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}> / {item.attendanceCountGym}P</Text>
            </Text>
            <Text style={[styles.cell, { color: theme.colors.text }]}>{item.bonusPoints}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1 }}>
            <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, padding: 5 }}>
                Totale Giocatori: {standings.length}
            </Text>
            <View style={[styles.tableHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.headerCell, styles.cellRank, { color: theme.colors.textSecondary }]}>#</Text>
                <Text style={[styles.headerCell, styles.cellTeam, { color: theme.colors.textSecondary }]}>Giocatore</Text>
                <Text style={[styles.headerCell, styles.cellPoints, { color: theme.colors.textSecondary }]}>PT</Text>
                <Text style={[styles.headerCell, { color: theme.colors.textSecondary }]}>C / P</Text>
                <Text style={[styles.headerCell, { color: theme.colors.textSecondary }]}>Bonus</Text>
            </View>
            <FlatList
                data={standings}
                renderItem={renderStandingsRow}
                keyExtractor={item => item.member.id}
                contentContainerStyle={{ paddingBottom: 80 }}
                initialNumToRender={50}
            />
        </View>
    );
};
