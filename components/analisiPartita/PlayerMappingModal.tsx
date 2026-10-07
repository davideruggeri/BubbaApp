import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Member } from '../../services/firestore';
import { RawImportedPlayer } from '../../utils/matchImporter';
import { analisiPartitaStyles as styles } from './analisiPartitaStyles';
import { useTheme } from '../../context/ThemeContext';

interface PlayerMappingModalProps {
    visible: boolean;
    onClose: () => void;
    importedRawPlayers: RawImportedPlayer[];
    allMembers: Member[];
    playerMappings: Record<string, string>;
    onUpdateMapping: (playerName: string, targetId: string) => void;
    onConfirm: () => void;
}

export const PlayerMappingModal: React.FC<PlayerMappingModalProps> = ({
    visible,
    onClose,
    importedRawPlayers,
    allMembers,
    playerMappings,
    onUpdateMapping,
    onConfirm
}) => {
    const { theme } = useTheme();

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.colors.card, maxWidth: 540 }]}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                        Collega Giocatori Importati
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 12, textAlign: 'center' }}>
                        Abbiamo trovato {importedRawPlayers.length} giocatori nel file. Associa ciascuno al membro corretto o confermalo come ospite:
                    </Text>

                    <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
                        <View style={{ gap: 8 }}>
                            {importedRawPlayers.map(p => {
                                const currentChoice = playerMappings[p.name.toLowerCase()] || 'guest';
                                return (
                                    <View
                                        key={p.name}
                                        style={{
                                            borderWidth: 1,
                                            borderColor: theme.colors.border,
                                            borderRadius: 10,
                                            padding: 10,
                                            backgroundColor: 'rgba(0,0,0,0.02)',
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: p.gender === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                                    ({p.gender})
                                                </Text>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                                    {p.name}
                                                </Text>
                                            </View>
                                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                                {currentChoice === 'guest' ? 'Ospite / Esterno' : 'Membro collegato ✓'}
                                            </Text>
                                        </View>

                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.mappingChip,
                                                    currentChoice === 'guest' && styles.mappingChipActive
                                                ]}
                                                onPress={() => {
                                                    onUpdateMapping(p.name.toLowerCase(), 'guest');
                                                }}
                                            >
                                                <Text style={[styles.mappingChipText, currentChoice === 'guest' && styles.mappingChipTextActive]}>
                                                    👤 Ospite ({p.name})
                                                </Text>
                                            </TouchableOpacity>

                                            {allMembers.map(m => {
                                                const isSel = currentChoice === m.id;
                                                return (
                                                    <TouchableOpacity
                                                        key={m.id}
                                                        style={[
                                                            styles.mappingChip,
                                                            isSel && styles.mappingChipActive
                                                        ]}
                                                        onPress={() => {
                                                            onUpdateMapping(p.name.toLowerCase(), m.id);
                                                        }}
                                                    >
                                                        <Text style={[styles.mappingChipText, isSel && styles.mappingChipTextActive]}>
                                                            {m.nickname || m.firstName} ({m.gender || 'M'})
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>

                    <View style={styles.modalButtons}>
                        <TouchableOpacity
                            style={[styles.modalBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                            onPress={onClose}
                        >
                            <Text style={{ color: theme.colors.text }}>Annulla</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalBtn, { backgroundColor: '#2E8540' }]}
                            onPress={onConfirm}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Conferma e Salva</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
