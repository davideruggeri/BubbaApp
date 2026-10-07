import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';
import { attendanceStyles as styles } from './attendanceStyles';

interface AttendanceGuestModalProps {
    visible: boolean;
    guestName: string;
    setGuestName: (name: string) => void;
    onAddGuest: () => void;
    onClose: () => void;
    theme: any;
}

export const AttendanceGuestModal: React.FC<AttendanceGuestModalProps> = ({
    visible,
    guestName,
    setGuestName,
    onAddGuest,
    onClose,
    theme,
}) => {
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Aggiungi Ospite</Text>
                    <TextInput
                        style={[
                            styles.input,
                            { backgroundColor: theme.colors.inputBackground, color: theme.colors.text },
                        ]}
                        placeholder="Nome Ospite"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={guestName}
                        onChangeText={setGuestName}
                        autoFocus={true}
                    />
                    <View style={styles.modalButtons}>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.cancelButton,
                                { backgroundColor: theme.colors.inputBackground },
                            ]}
                            onPress={onClose}
                        >
                            <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>
                                Annulla
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.saveButton]}
                            onPress={onAddGuest}
                        >
                            <Text style={styles.buttonText}>Aggiungi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
