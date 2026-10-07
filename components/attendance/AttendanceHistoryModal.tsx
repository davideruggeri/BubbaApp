import React from 'react';
import { View, Text, Modal, FlatList, TouchableOpacity } from 'react-native';
import { attendanceStyles as styles } from './attendanceStyles';
import { MemberHistoryData } from './attendanceTypes';

interface AttendanceHistoryModalProps {
    visible: boolean;
    data: MemberHistoryData | null;
    loading: boolean;
    theme: any;
    onClose: () => void;
}

export const AttendanceHistoryModal: React.FC<AttendanceHistoryModalProps> = ({
    visible,
    data,
    loading,
    theme,
    onClose,
}) => {
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={[styles.modalView, { height: '70%', backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                        Storico Presenze
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                        {data?.member.nickname || data?.member.firstName}
                    </Text>

                    {/* Streak Stats */}
                    {!loading && data && (
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-around',
                                width: '100%',
                                marginBottom: 15,
                                marginTop: 10,
                            }}
                        >
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.colors.primary }}>
                                    {data.currentStreak}
                                </Text>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                    Streak Attuale
                                </Text>
                            </View>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.colors.warning }}>
                                    {data.maxStreak}
                                </Text>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                    Max Streak
                                </Text>
                            </View>
                        </View>
                    )}

                    {loading ? (
                        <Text>Caricamento...</Text>
                    ) : (
                        <FlatList
                            data={data?.history}
                            keyExtractor={(item) => item.date}
                            renderItem={({ item }) => (
                                <View
                                    style={[
                                        styles.historyRow,
                                        {
                                            borderBottomColor: theme.colors.border,
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                        },
                                    ]}
                                >
                                    <Text
                                        style={{
                                            fontSize: 18,
                                            fontWeight: '600',
                                            color: item.present ? theme.colors.success : theme.colors.danger,
                                            textAlign: 'center',
                                        }}
                                    >
                                        {new Date(item.date).toLocaleDateString('it-IT', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                        })}
                                    </Text>
                                </View>
                            )}
                            style={{ width: '100%', marginTop: 10 }}
                            ListEmptyComponent={
                                <Text
                                    style={{
                                        fontStyle: 'italic',
                                        textAlign: 'center',
                                        marginTop: 20,
                                        color: theme.colors.textSecondary,
                                    }}
                                >
                                    Nessun allenamento passato trovato.
                                </Text>
                            }
                        />
                    )}

                    <TouchableOpacity
                        style={[styles.fullWidthButton, { backgroundColor: theme.colors.inputBackground }]}
                        onPress={onClose}
                    >
                        <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};
