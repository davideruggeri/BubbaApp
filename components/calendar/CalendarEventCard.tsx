import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Event } from '../../services/firestore';
import { calendarStyles as styles } from './calendarStyles';
import { getTypeColor, translateType, getMonthName, formatDate } from './calendarUtils';

interface CalendarEventCardProps {
    item: Event;
    style?: any;
    theme: any;
    isBubbaOnly?: boolean;
    onPressTournament: (item: Event) => void;
    onPressEdit: (item: Event) => void;
}

export const CalendarEventCard: React.FC<CalendarEventCardProps> = ({
    item,
    style,
    theme,
    isBubbaOnly,
    onPressTournament,
    onPressEdit,
}) => {
    const isTournamentOrOther = item.type === 'tournament' || item.type === 'other';

    return (
        <TouchableOpacity
            onPress={() => {
                if (isTournamentOrOther) {
                    onPressTournament(item);
                } else if (!isBubbaOnly) {
                    onPressEdit(item);
                }
            }}
            activeOpacity={isBubbaOnly && !isTournamentOrOther ? 1 : 0.7}
        >
            <View style={[styles.eventCard, style, { backgroundColor: theme.colors.card }]}>
                <View style={[styles.dateBox, { backgroundColor: getTypeColor(item.type, theme) }]}>
                    <Text style={styles.dateDay}>{item.date.split('-')[2]}</Text>
                    <Text style={styles.dateMonth}>{getMonthName(item.date)}</Text>
                </View>
                <View style={styles.eventInfo}>
                    <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{item.title}</Text>
                    <Text style={[styles.eventType, { color: theme.colors.textSecondary }]}>
                        {translateType(item.type, item.subType)}
                        {item.endDate ? ` (fino al ${formatDate(item.endDate)})` : ''}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};
