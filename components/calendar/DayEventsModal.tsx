import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Event } from '../../services/firestore';
import { calendarStyles as styles } from './calendarStyles';
import { formatDate } from './calendarUtils';
import { CalendarEventCard } from './CalendarEventCard';

interface DayEventsModalProps {
    visible: boolean;
    selectedDate: string;
    events: Event[];
    theme: any;
    isBubbaOnly?: boolean;
    onClose: () => void;
    onAddEvent: (date: string) => void;
    onPressTournament: (item: Event) => void;
    onPressEdit: (item: Event) => void;
}

export const DayEventsModal: React.FC<DayEventsModalProps> = ({
    visible,
    selectedDate,
    events,
    theme,
    isBubbaOnly,
    onClose,
    onAddEvent,
    onPressTournament,
    onPressEdit,
}) => {
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                        {selectedDate ? formatDate(selectedDate) : ''}
                    </Text>

                    <ScrollView style={{ width: '100%', maxHeight: 300 }}>
                        {events.length > 0 ? (
                            events.map((event, index) => (
                                <View key={event.id}>
                                    <CalendarEventCard
                                        item={event}
                                        style={index === events.length - 1 ? { marginBottom: 0 } : undefined}
                                        theme={theme}
                                        isBubbaOnly={isBubbaOnly}
                                        onPressTournament={onPressTournament}
                                        onPressEdit={onPressEdit}
                                    />
                                </View>
                            ))
                        ) : (
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                Nessun evento.
                            </Text>
                        )}
                    </ScrollView>

                    {!isBubbaOnly && (
                        <TouchableOpacity
                            style={[styles.saveButton, { marginTop: 20, backgroundColor: theme.colors.primary }]}
                            onPress={() => onAddEvent(selectedDate)}
                        >
                            <Text style={styles.textStyle}>+ Aggiungi Evento</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.closeButton, { backgroundColor: theme.colors.inputBackground }]}
                        onPress={onClose}
                    >
                        <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>
                            Chiudi
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};
