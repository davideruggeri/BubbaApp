import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Event } from '../../services/firestore';
import { calendarStyles as styles } from './calendarStyles';
import { formatDate } from './calendarUtils';

interface TournamentInfoModalProps {
    visible: boolean;
    event: Event | null;
    theme: any;
    isBubbaOnly?: boolean;
    onClose: () => void;
    onEditTournament: (event: Event) => void;
    onManageParticipants: (event: Event) => void;
}

export const TournamentInfoModal: React.FC<TournamentInfoModalProps> = ({
    visible,
    event,
    theme,
    isBubbaOnly,
    onClose,
    onEditTournament,
    onManageParticipants,
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
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            marginBottom: 15,
                        }}
                    >
                        <Text style={[styles.modalTitle, { color: theme.colors.text, marginBottom: 0, flex: 1 }]}>
                            {event?.title}
                        </Text>
                        {!isBubbaOnly && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (event) {
                                        onClose();
                                        onEditTournament(event);
                                    }
                                }}
                            >
                                <Image
                                    source={require('../../assets/gear.png')}
                                    style={{ width: 24, height: 24, tintColor: theme.colors.text }}
                                />
                            </TouchableOpacity>
                        )}
                    </View>

                    <ScrollView style={{ width: '100%', maxHeight: 400 }}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Data:</Text>
                        <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left' }]}>
                            {event ? formatDate(event.date) : ''}
                            {event?.endDate ? ` - ${formatDate(event.endDate)}` : ''}
                        </Text>

                        {event?.location && (
                            <>
                                <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Luogo:</Text>
                                <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left' }]}>
                                    {event.location}
                                </Text>
                            </>
                        )}

                        {event?.playerFee && (
                            <>
                                <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Player Fee:</Text>
                                <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left' }]}>
                                    {event.playerFee}
                                </Text>
                            </>
                        )}

                        {event?.teamFee && (
                            <>
                                <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Team Fee:</Text>
                                <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left' }]}>
                                    {event.teamFee}
                                </Text>
                            </>
                        )}

                        {event?.additionalInfo && (
                            <>
                                <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Info Aggiuntive:</Text>
                                <Text style={[styles.textStyle, { color: theme.colors.text, marginBottom: 15, textAlign: 'left' }]}>
                                    {event.additionalInfo}
                                </Text>
                            </>
                        )}

                        {event?.type === 'other' && event.subType && (
                            <>
                                <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 5 }]}>Sotto-sezione:</Text>
                                <Text
                                    style={[
                                        styles.textStyle,
                                        { color: theme.colors.text, marginBottom: 15, textAlign: 'left', textTransform: 'capitalize' },
                                    ]}
                                >
                                    {event.subType}
                                </Text>
                            </>
                        )}

                        {(event?.type === 'tournament' || event?.type === 'other') && (
                            <TouchableOpacity
                                style={[
                                    styles.participantsButton,
                                    { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.primary, marginTop: 10 },
                                ]}
                                onPress={() => {
                                    if (event) {
                                        onClose();
                                        onManageParticipants(event);
                                    }
                                }}
                            >
                                <Text style={[styles.participantsButtonText, { color: theme.colors.primary }]}>
                                    👥 Gestisci Roster / Partecipanti
                                </Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.closeButton, { backgroundColor: theme.colors.inputBackground, marginTop: 10 }]}
                        onPress={onClose}
                    >
                        <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};
