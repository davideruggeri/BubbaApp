import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { BonusDefinition } from '../../services/firestore';
import { leagueStyles as styles } from './leagueStyles';
import { useTheme } from '../../context/ThemeContext';

interface LeagueBonusListTabProps {
    bonusDefinitions: BonusDefinition[];
    isBubbaOnly: boolean;
    onOpenAddExtraBonus: () => void;
}

export const LeagueBonusListTab: React.FC<LeagueBonusListTabProps> = ({
    bonusDefinitions,
    isBubbaOnly,
    onOpenAddExtraBonus
}) => {
    const { theme } = useTheme();

    return (
        <ScrollView style={styles.rulesContainer} contentContainerStyle={{ paddingBottom: 40 }}>
            {!isBubbaOnly && (
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        {
                            backgroundColor: theme.colors.primary,
                            marginBottom: 20,
                            flexDirection: 'row',
                            justifyContent: 'center',
                            width: '100%'
                        }
                    ]}
                    onPress={onOpenAddExtraBonus}
                >
                    <Text style={[styles.actionButtonText, { fontSize: 16, marginLeft: 5 }]}>➕ Aggiungi Bonus Extra</Text>
                </TouchableOpacity>
            )}
            <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Bonus</Text>
            {bonusDefinitions.filter(b => b.type === 'bonus').map((bonus, index) => (
                <View key={index} style={[styles.ruleCard, { backgroundColor: theme.colors.card }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>{bonus.label}</Text>
                        <Text style={[styles.ruleTitle, { color: theme.colors.success }]}>+{bonus.points}</Text>
                    </View>
                </View>
            ))}
            <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Malus</Text>
            {bonusDefinitions.filter(b => b.type === 'malus').map((malus, index) => (
                <View key={index} style={[styles.ruleCard, { backgroundColor: theme.colors.card }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>{malus.label}</Text>
                        <Text style={[styles.ruleTitle, { color: theme.colors.danger }]}>{malus.points}</Text>
                    </View>
                </View>
            ))}
            {bonusDefinitions.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>Nessun bonus/malus definito.</Text>
                </View>
            )}
        </ScrollView>
    );
};
