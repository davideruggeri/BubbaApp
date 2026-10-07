import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { MatchAnalysis, Event } from '../../services/firestore/types';
import { formatTournamentDay } from '../../screens/AnalisiPartitaScreen';
import { tournamentDetailStyles as styles } from './tournamentDetailStyles';

const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

interface EditMatchDateModalProps {
    visible: boolean;
    dateEditingMatch: MatchAnalysis | null;
    tournamentDays: string[];
    theme: any;
    onClose: () => void;
    onSelectDay: (dayStr: string) => void;
    onOpenDatePicker: () => void;
}

export const EditMatchDateModal: React.FC<EditMatchDateModalProps> = ({
    visible,
    dateEditingMatch,
    tournamentDays,
    theme,
    onClose,
    onSelectDay,
    onOpenDatePicker,
}) => {
    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                        📅 Data Partita Torneo
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                        Bubba vs {dateEditingMatch?.opponent} • Data attuale: {formatDate(dateEditingMatch?.date || '')}
                    </Text>

                    {tournamentDays.length > 0 ? (
                        <View style={{ marginTop: 12 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text, marginBottom: 8 }}>
                                Seleziona il giorno della partita tra quelli del torneo:
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {tournamentDays.map((dayStr, idx) => {
                                    const isSelected = dateEditingMatch?.date === dayStr;
                                    return (
                                        <TouchableOpacity
                                            key={dayStr}
                                            style={[
                                                styles.dayChipBtn,
                                                { borderColor: isSelected ? theme.colors.primary : theme.colors.border },
                                                isSelected && { backgroundColor: theme.colors.primary },
                                            ]}
                                            onPress={() => onSelectDay(dayStr)}
                                        >
                                            <Text style={[styles.dayChipNum, { color: isSelected ? '#C0D725' : theme.colors.textSecondary }]}>
                                                Giorno {idx + 1}
                                            </Text>
                                            <Text style={[styles.dayChipDate, { color: isSelected ? '#fff' : theme.colors.text }]}>
                                                {formatTournamentDay(dayStr)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    ) : (
                        <View style={{ marginVertical: 12, padding: 10, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.03)' }}>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                Nessuna data a calendario specificata per questo torneo. Puoi scegliere una data manuale sotto.
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.customDateBtn, { borderColor: theme.colors.border }]}
                        onPress={onOpenDatePicker}
                    >
                        <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>
                            🗓️ Scegli altra data dal calendario...
                        </Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                        <TouchableOpacity
                            style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
                            onPress={onClose}
                        >
                            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Annulla</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

interface LinkTournamentModalProps {
    visible: boolean;
    tournamentName: string;
    tournamentCalendarEvents: Event[];
    tournamentEvent: Event | null;
    theme: any;
    onClose: () => void;
    onSelectEvent: (ev: Event) => void;
}

export const LinkTournamentModal: React.FC<LinkTournamentModalProps> = ({
    visible,
    tournamentName,
    tournamentCalendarEvents,
    tournamentEvent,
    theme,
    onClose,
    onSelectEvent,
}) => {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, maxHeight: '80%' }]}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                        🔗 Collega Torneo a Calendario
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                        Seleziona l'evento a calendario a cui associare le partite di "{tournamentName}":
                    </Text>

                    <ScrollView style={{ marginTop: 10, maxHeight: 320 }} nestedScrollEnabled>
                        <View style={{ gap: 6 }}>
                            {tournamentCalendarEvents.length === 0 ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' }}>
                                        Nessun torneo o campionato trovato a calendario.
                                    </Text>
                                </View>
                            ) : (
                                tournamentCalendarEvents.map((ev) => {
                                    const isCurrentLinked = tournamentEvent?.id === ev.id;
                                    const isChampionship = (ev.type || '').toLowerCase().includes('championship') || (ev.type || '').toLowerCase().includes('campionato');
                                    return (
                                        <TouchableOpacity
                                            key={ev.id}
                                            style={[
                                                styles.eventListItem,
                                                { borderColor: theme.colors.border, backgroundColor: isCurrentLinked ? theme.colors.primary + '15' : 'transparent' },
                                                isCurrentLinked && { borderColor: theme.colors.primary },
                                            ]}
                                            onPress={() => onSelectEvent(ev)}
                                        >
                                            <Text style={{ fontSize: 18 }}>{isChampionship ? '🏅' : '🏆'}</Text>
                                            <View style={{ flex: 1, marginLeft: 8 }}>
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>
                                                    {ev.title}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                                    {formatDate(ev.date)}{ev.endDate && ev.endDate !== ev.date ? ` – ${formatDate(ev.endDate)}` : ''}
                                                </Text>
                                            </View>
                                            {isCurrentLinked && (
                                                <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>✓ Collegato</Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
                    </ScrollView>

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 }}>
                        <TouchableOpacity
                            style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
                            onPress={onClose}
                        >
                            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
