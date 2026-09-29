import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type DatePickerModalProps = {
    visible: boolean;
    onClose: () => void;
    onSelectDate: (date: string) => void;
    initialDate?: string;
    validDates?: string[];
};

export default function DatePickerModal({ visible, onClose, onSelectDate, initialDate, validDates }: DatePickerModalProps) {
    const { theme } = useTheme();
    const [currentMonth, setCurrentMonth] = useState(initialDate ? new Date(initialDate) : new Date());

    const [viewMode, setViewMode] = useState<'calendar' | 'year'>('calendar');

    const changeMonth = (increment: number) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentMonth(newDate);
    };

    const changeYear = (year: number) => {
        const newDate = new Date(currentMonth);
        newDate.setFullYear(year);
        setCurrentMonth(newDate);
        setViewMode('calendar');
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon

        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        const daysArray = [];
        for (let i = 0; i < adjustedFirstDay; i++) {
            daysArray.push(null);
        }
        for (let i = 1; i <= days; i++) {
            daysArray.push(new Date(year, month, i));
        }
        return daysArray;
    };

    const handleDayPress = (date: Date) => {
        // Use local time components to avoid timezone shifts caused by toISOString()
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        onSelectDate(dateStr);
        onClose();
    };

    const renderYearPicker = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let i = currentYear - 100; i <= currentYear + 5; i++) {
            years.push(i);
        }
        // Reverse to show newest years first
        years.reverse();

        return (
            <View style={styles.yearContainer}>
                <Text style={[styles.yearTitle, { color: theme.colors.text }]}>Seleziona Anno</Text>
                <FlatList
                    data={years}
                    keyExtractor={(item) => item.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[
                                styles.yearItem,
                                { borderBottomColor: theme.colors.border },
                                item === currentMonth.getFullYear() && { backgroundColor: theme.colors.inputBackground }
                            ]}
                            onPress={() => changeYear(item)}
                        >
                            <Text style={[
                                styles.yearText,
                                { color: theme.colors.text },
                                item === currentMonth.getFullYear() && { color: theme.colors.primary, fontWeight: 'bold' }
                            ]}>{item}</Text>
                        </TouchableOpacity>
                    )}
                    getItemLayout={(data, index) => (
                        { length: 50, offset: 50 * index, index }
                    )}
                    initialScrollIndex={years.indexOf(currentMonth.getFullYear()) > -1 ? years.indexOf(currentMonth.getFullYear()) : 0}
                />
            </View>
        );
    };

    const renderCalendarGrid = () => {
        const days = getDaysInMonth(currentMonth);
        const weekDays = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

        return (
            <View style={styles.calendarContainer}>
                <View style={styles.monthHeader}>
                    <TouchableOpacity onPress={() => changeMonth(-1)}>
                        <Image
                            source={require('../assets/arrow.png')}
                            style={[styles.arrowIcon, { transform: [{ rotate: '180deg' }], tintColor: theme.colors.primary }]}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setViewMode('year')}>
                        <Text style={[styles.monthTitle, { color: theme.colors.text }]}>
                            {currentMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => changeMonth(1)}>
                        <Image
                            source={require('../assets/arrow.png')}
                            style={[styles.arrowIcon, { tintColor: theme.colors.primary }]}
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.weekDaysRow}>
                    {weekDays.map(day => (
                        <Text key={day} style={[styles.weekDayText, { color: theme.colors.textSecondary }]}>{day}</Text>
                    ))}
                </View>

                <View style={styles.daysGrid}>
                    {days.map((date, index) => {
                        if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;

                        // Use local time components
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const dateStr = `${year}-${month}-${day}`;

                        // Compare with today (local)
                        const today = new Date();
                        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                        const isToday = dateStr === todayStr;
                        const isSelected = initialDate === dateStr;

                        // Check validity
                        const isValid = !validDates || validDates.includes(dateStr);

                        return (
                            <TouchableOpacity
                                key={dateStr}
                                style={[
                                    styles.dayCell,
                                    isToday && { backgroundColor: theme.colors.inputBackground },
                                    isSelected && { backgroundColor: theme.colors.primary },
                                    !isValid && styles.disabledCell
                                ]}
                                onPress={() => isValid && handleDayPress(date)}
                                disabled={!isValid}
                            >
                                <Text style={[
                                    styles.dayNumber,
                                    { color: theme.colors.text },
                                    isToday && { color: theme.colors.primary, fontWeight: 'bold' },
                                    isSelected && { color: '#fff', fontWeight: 'bold' },
                                    !isValid && { color: theme.colors.textSecondary, opacity: 0.3 }
                                ]}>{date.getDate()}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.modalTitle, { color: theme.colors.primary }]}>Seleziona Data</Text>

                    {viewMode === 'calendar' ? renderCalendarGrid() : renderYearPicker()}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        margin: 20,
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '90%',
        maxWidth: 400,
        maxHeight: '80%',
        overflow: 'hidden',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#003399',
    },
    calendarContainer: {
        width: '100%',
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    monthTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    weekDaysRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 10,
    },
    weekDayText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#888',
        width: 35,
        textAlign: 'center',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 5,
    },
    todayCell: {
        backgroundColor: '#e3f2fd',
        borderRadius: 20,
    },
    selectedCell: {
        backgroundColor: '#003399',
        borderRadius: 20,
    },
    dayNumber: {
        fontSize: 16,
        color: '#333',
    },
    todayText: {
        color: '#003399',
        fontWeight: 'bold',
    },
    selectedText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    closeButton: {
        marginTop: 20,
        padding: 10,
    },
    closeButtonText: {
        color: "#666",
        fontSize: 16,
    },
    yearContainer: {
        width: '100%',
        height: 300,
    },
    yearTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    yearItem: {
        padding: 15,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    selectedYearItem: {
        backgroundColor: '#e3f2fd',
    },
    yearText: {
        fontSize: 18,
        color: '#333',
    },
    selectedYearText: {
        color: '#003399',
        fontWeight: 'bold',
    },
    arrowIcon: {
        width: 24,
        height: 24,
        tintColor: '#003399',
    },
    disabledCell: {
        opacity: 0.3,
    },
    disabledText: {
        color: '#ccc',
    },
});
