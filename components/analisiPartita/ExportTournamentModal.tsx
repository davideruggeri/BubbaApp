import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { MatchGroup } from './analisiPartitaTypes';
import { analisiPartitaStyles as styles } from './analisiPartitaStyles';
import { useTheme } from '../../context/ThemeContext';
import { exportAndDownloadXLSX } from '../../utils/matchExporter';
import { showAlert } from '../../utils/alert';

interface ExportTournamentModalProps {
    visible: boolean;
    onClose: () => void;
    groupedMatches: MatchGroup[];
    playerMap: Record<string, { name: string; g: 'M' | 'F' }>;
}

export const ExportTournamentModal: React.FC<ExportTournamentModalProps> = ({
    visible,
    onClose,
    groupedMatches,
    playerMap
}) => {
    const { theme } = useTheme();

    if (!visible) return null;

    const tournamentGroups = groupedMatches.filter(g => !g.isSingleGroup && g.matches.length > 0);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.colors.card, maxWidth: 440 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: 18 }]}>
                            📊 Esporta Excel Torneo
                        </Text>
                        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, fontWeight: 'bold' }}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 14 }}>
                        Seleziona quale torneo desideri esportare in foglio Excel:
                    </Text>

                    <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                        <View style={{ gap: 8 }}>
                            {tournamentGroups.map(tGroup => (
                                <TouchableOpacity
                                    key={tGroup.id}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: 12,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: theme.colors.border,
                                        backgroundColor: theme.dark ? '#1E293B' : '#F8FAFC'
                                    }}
                                    onPress={async () => {
                                        onClose();
                                        try {
                                            await exportAndDownloadXLSX(tGroup.matches, playerMap);
                                            showAlert("Esportazione completata", `Il foglio Excel di "${tGroup.title}" è stato scaricato.`);
                                        } catch (error: any) {
                                            showAlert("Errore Esportazione", error?.message || "Impossibile esportare l'Excel.");
                                        }
                                    }}
                                >
                                    <Text style={{ fontSize: 24, marginRight: 10 }}>🏆</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                            {tGroup.title}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>
                                            {tGroup.matches.length} {tGroup.matches.length === 1 ? 'partita' : 'partite'}{tGroup.dateRange ? ` • ${tGroup.dateRange}` : ''}
                                        </Text>
                                    </View>
                                    <View style={{ backgroundColor: '#2E8540', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Scarica ➔</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}

                            {/* Opzione: Tutti i tornei combinati */}
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: 12,
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: '#2E8540',
                                    backgroundColor: theme.dark ? '#143820' : '#E8F5E9'
                                }}
                                onPress={async () => {
                                    onClose();
                                    try {
                                        const allTournamentMatches = tournamentGroups.flatMap(g => g.matches);
                                        await exportAndDownloadXLSX(allTournamentMatches, playerMap);
                                        showAlert("Esportazione completata", "Tutte le partite di torneo sono state esportate in Excel.");
                                    } catch (error: any) {
                                        showAlert("Errore Esportazione", error?.message || "Impossibile esportare l'Excel.");
                                    }
                                }}
                            >
                                <Text style={{ fontSize: 24, marginRight: 10 }}>📁</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                        Tutti i tornei combinati
                                    </Text>
                                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>
                                        Esporta tutte le {tournamentGroups.reduce((acc, g) => acc + g.matches.length, 0)} partite in fogli separati
                                    </Text>
                                </View>
                                <View style={{ backgroundColor: '#2E8540', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Tutti ➔</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.modalBtn, { borderColor: theme.colors.border, borderWidth: 1, marginTop: 14 }]}
                        onPress={onClose}
                    >
                        <Text style={{ color: theme.colors.text }}>Annulla</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};
