import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Event } from '../../services/firestore';
import { homeStyles as styles } from './homeStyles';

interface HomeNextEventCardProps {
    nextEvent: Event;
    theme: any;
    onPress: () => void;
    onFindEgg: () => void;
}

const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

const translateType = (type: string) => {
    switch (type) {
        case 'training':
        case 'Campo':
        case 'Palestra':
            return 'ALLENAMENTO';
        case 'match':
            return 'AMICHEVOLE';
        case 'championship':
            return 'CAMPIONATO';
        case 'tournament':
            return 'TORNEO';
        case 'social':
            return 'RIUNIONE DI SQUADRA';
        case 'other':
            return 'ALTRO';
        case 'birthday':
            return 'COMPLEANNO';
        default:
            return type.toUpperCase();
    }
};

export const HomeNextEventCard: React.FC<HomeNextEventCardProps> = ({
    nextEvent,
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
                    📅 Prossimo Evento 📅
                </Text>
            </TouchableOpacity>
            <View
                style={[
                    styles.eventCard,
                    { backgroundColor: theme.colors.card, borderLeftColor: theme.colors.primary },
                ]}
            >
                <Text style={[styles.eventTitle, { color: theme.colors.text }]}>{nextEvent.title}</Text>
                <Text style={[styles.eventDate, { color: theme.colors.textSecondary }]}>
                    {formatDate(nextEvent.date)}
                    {nextEvent.endDate ? ` - ${formatDate(nextEvent.endDate)}` : ''}
                </Text>
                <Text style={[styles.eventType, { color: theme.colors.primary }]}>
                    {translateType(nextEvent.type)}
                </Text>
            </View>
        </TouchableOpacity>
    );
};
