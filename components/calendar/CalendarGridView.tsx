import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Event } from '../../services/firestore';
import { calendarStyles as styles } from './calendarStyles';
import { getDaysInMonth, toLocalISOString, isEventOnDate, getTypeColor } from './calendarUtils';

interface CalendarGridViewProps {
    currentMonth: Date;
    onChangeMonth: (increment: number) => void;
    allEvents: Event[];
    onSelectDate: (dateStr: string) => void;
    theme: any;
}

const WEEK_DAYS = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

export const CalendarGridView: React.FC<CalendarGridViewProps> = ({
    currentMonth,
    onChangeMonth,
    allEvents,
    onSelectDate,
    theme,
}) => {
    const days = getDaysInMonth(currentMonth);
    const todayStr = toLocalISOString(new Date());

    return (
        <View style={[styles.calendarContainer, { backgroundColor: theme.colors.card }]}>
            <View style={styles.monthHeader}>
                <TouchableOpacity onPress={() => onChangeMonth(-1)}>
                    <Text style={[styles.monthNav, { color: theme.colors.primary }]}>{'<'}</Text>
                </TouchableOpacity>
                <Text style={[styles.monthTitle, { color: theme.colors.text }]}>
                    {currentMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase()}
                </Text>
                <TouchableOpacity onPress={() => onChangeMonth(1)}>
                    <Text style={[styles.monthNav, { color: theme.colors.primary }]}>{'>'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.weekDaysRow}>
                {WEEK_DAYS.map(day => (
                    <Text key={day} style={[styles.weekDayText, { color: theme.colors.textSecondary }]}>
                        {day}
                    </Text>
                ))}
            </View>

            <View style={styles.daysGrid}>
                {days.map((date, index) => {
                    if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;

                    const dateStr = toLocalISOString(date);
                    const dayEvents = allEvents
                        .filter(e => isEventOnDate(e, dateStr))
                        .sort((a, b) => {
                            const isMultiDayA = a.endDate && a.date !== a.endDate;
                            const isMultiDayB = b.endDate && b.date !== b.endDate;
                            if (isMultiDayA && !isMultiDayB) return -1;
                            if (!isMultiDayA && isMultiDayB) return 1;
                            return a.date.localeCompare(b.date);
                        });

                    const isToday = dateStr === todayStr;

                    return (
                        <TouchableOpacity
                            key={dateStr}
                            style={[
                                styles.dayCell,
                                isToday && [styles.todayCell, { backgroundColor: theme.colors.inputBackground }],
                            ]}
                            onPress={() => onSelectDate(dateStr)}
                        >
                            <Text
                                style={[
                                    styles.dayNumber,
                                    { color: theme.colors.text },
                                    isToday && [styles.todayText, { color: theme.colors.primary }],
                                ]}
                            >
                                {date.getDate()}
                            </Text>
                            <View style={styles.eventsContainer}>
                                {dayEvents.slice(0, 4).map((ev, i) => {
                                    const isStart = ev.date === dateStr;
                                    const isEnd = ev.endDate === dateStr;
                                    const isSingleDay = !ev.endDate || ev.date === ev.endDate;

                                    if (isSingleDay) {
                                        return (
                                            <View
                                                key={i}
                                                style={[styles.eventDot, { backgroundColor: getTypeColor(ev.type, theme) }]}
                                            />
                                        );
                                    }

                                    return (
                                        <View
                                            key={i}
                                            style={[
                                                styles.eventBar,
                                                { backgroundColor: getTypeColor(ev.type, theme) },
                                                isStart && styles.eventBarStart,
                                                isEnd && styles.eventBarEnd,
                                                !isStart && !isEnd && styles.eventBarMiddle,
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};
