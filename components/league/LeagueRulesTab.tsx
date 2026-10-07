import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { LeagueRule } from '../../services/firestore';
import { leagueStyles as styles } from './leagueStyles';
import { useTheme } from '../../context/ThemeContext';

interface LeagueRulesTabProps {
    rules: LeagueRule[];
}

export const LeagueRulesTab: React.FC<LeagueRulesTabProps> = ({ rules }) => {
    const { theme } = useTheme();

    return (
        <ScrollView style={styles.rulesContainer} contentContainerStyle={{ paddingBottom: 40 }}>
            {rules.map((rule) => (
                <View key={rule.id} style={[styles.ruleCard, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>{rule.title}</Text>
                    <Text style={[styles.ruleText, { color: theme.colors.textSecondary }]}>{rule.description}</Text>
                </View>
            ))}
            {rules.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessuna regola definita.</Text>
                </View>
            )}
        </ScrollView>
    );
};
