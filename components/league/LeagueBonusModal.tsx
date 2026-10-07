import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Member, BonusDefinition } from '../../services/firestore';
import { BonusTypeTab } from './leagueTypes';
import { leagueStyles as styles } from './leagueStyles';
import { useTheme } from '../../context/ThemeContext';
import { showAlert } from '../../utils/alert';

interface LeagueBonusModalProps {
    visible: boolean;
    onClose: () => void;
    bonusDefinitions: BonusDefinition[];
    members: Member[];
    initialMemberId?: string;
    bonusDate: string;
    isBonusListTab: boolean;
    formatDateForDisplay: (date?: string | null) => string;
    onAddBonus: (memberId: string, points: number, reason: string, date: string) => Promise<boolean>;
    onOpenDatePicker: () => void;
    customDate?: string;
}

export const LeagueBonusModal: React.FC<LeagueBonusModalProps> = ({
    visible,
    onClose,
    bonusDefinitions,
    members,
    initialMemberId = '',
    bonusDate,
    isBonusListTab,
    formatDateForDisplay,
    onAddBonus,
    onOpenDatePicker,
    customDate
}) => {
    const { theme } = useTheme();
    const [bonusTypeTab, setBonusTypeTab] = useState<BonusTypeTab>('bonus');
    const [selectedMemberId, setSelectedMemberId] = useState(initialMemberId);
    const [customReason, setCustomReason] = useState('');
    const [customPoints, setCustomPoints] = useState('');

    useEffect(() => {
        if (visible) {
            setSelectedMemberId(initialMemberId || (members[0]?.id || ''));
            setCustomReason('');
            setCustomPoints('');
            setBonusTypeTab('bonus');
        }
    }, [visible, initialMemberId, members]);

    const targetDate = isBonusListTab && customDate ? customDate : bonusDate;
    const selectedMember = members.find(m => m.id === selectedMemberId);
    const memberDisplayName = selectedMember
        ? (selectedMember.nickname || selectedMember.firstName)
        : '';

    const handleSelectOption = async (points: number, reason: string) => {
        if (!selectedMemberId) {
            showAlert("Errore", "Seleziona un giocatore.");
            return;
        }
        const success = await onAddBonus(selectedMemberId, points, reason, targetDate);
        if (success) {
            onClose();
        }
    };

    const handleManualAdd = async () => {
        if (!customReason.trim() || !customPoints.trim()) {
            showAlert("Errore", "Compila tutti i campi.");
            return;
        }
        const points = parseInt(customPoints, 10);
        if (isNaN(points)) {
            showAlert("Errore", "Punti non validi.");
            return;
        }
        if (!selectedMemberId) {
            showAlert("Errore", "Seleziona un giocatore.");
            return;
        }
        const success = await onAddBonus(selectedMemberId, points, customReason.trim(), targetDate);
        if (success) {
            onClose();
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalOverlay}
            >
                <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                    <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Nuovo Bonus/Malus</Text>

                        <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                            {isBonusListTab ? 'Bonus Generico' : `${memberDisplayName} - ${formatDateForDisplay(bonusDate)}`}
                        </Text>

                        {isBonusListTab && (
                            <View style={{ marginBottom: 15 }}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Giocatore:</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                    {[...members]
                                        .sort((a, b) => (a.nickname || a.firstName).localeCompare(b.nickname || b.firstName))
                                        .map(m => (
                                            <TouchableOpacity
                                                key={m.id}
                                                style={[
                                                    styles.chip,
                                                    selectedMemberId === m.id && { backgroundColor: theme.colors.primary },
                                                    { borderColor: theme.colors.border, borderWidth: 1 }
                                                ]}
                                                onPress={() => setSelectedMemberId(m.id)}
                                            >
                                                <Text style={[
                                                    styles.chipText,
                                                    selectedMemberId === m.id ? { color: '#fff' } : { color: theme.colors.text }
                                                ]}>
                                                    {m.nickname || m.firstName}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                </ScrollView>

                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Data:</Text>
                                <TouchableOpacity
                                    onPress={onOpenDatePicker}
                                    style={[styles.dateInput, { backgroundColor: theme.colors.inputBackground, marginBottom: 0 }]}
                                >
                                    <Text style={{ color: theme.colors.text }}>{formatDateForDisplay(targetDate)}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={[styles.modalTabContainer, { borderBottomColor: theme.colors.border }]}>
                            <TouchableOpacity
                                style={[styles.modalTab, bonusTypeTab === 'bonus' && styles.modalTabActive]}
                                onPress={() => setBonusTypeTab('bonus')}
                            >
                                <Text style={[
                                    styles.modalTabText,
                                    bonusTypeTab === 'bonus' && styles.modalTabTextActive,
                                    { color: bonusTypeTab === 'bonus' ? '#003399' : theme.colors.textSecondary }
                                ]}>
                                    Bonus
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalTab, bonusTypeTab === 'malus' && styles.modalTabActive]}
                                onPress={() => setBonusTypeTab('malus')}
                            >
                                <Text style={[
                                    styles.modalTabText,
                                    bonusTypeTab === 'malus' && styles.modalTabTextActive,
                                    { color: bonusTypeTab === 'malus' ? '#003399' : theme.colors.textSecondary }
                                ]}>
                                    Malus
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalTab, bonusTypeTab === 'custom' && styles.modalTabActive]}
                                onPress={() => setBonusTypeTab('custom')}
                            >
                                <Text style={[
                                    styles.modalTabText,
                                    bonusTypeTab === 'custom' && styles.modalTabTextActive,
                                    { color: bonusTypeTab === 'custom' ? '#003399' : theme.colors.textSecondary }
                                ]}>
                                    Personalizzato
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {bonusTypeTab === 'custom' ? (
                            <View>
                                <TextInput
                                    style={[
                                        styles.input,
                                        { width: '100%', marginBottom: 15, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }
                                    ]}
                                    placeholder="Motivazione"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={customReason}
                                    onChangeText={setCustomReason}
                                />
                                <TextInput
                                    style={[
                                        styles.input,
                                        { width: '100%', marginBottom: 15, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }
                                    ]}
                                    placeholder="Punti (es. 1 o -1)"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    keyboardType="numeric"
                                    value={customPoints}
                                    onChangeText={setCustomPoints}
                                />
                                <TouchableOpacity
                                    style={[
                                        styles.actionButton,
                                        { backgroundColor: theme.colors.primary, alignSelf: 'center', width: '100%', borderRadius: 8, height: 50, marginLeft: 0 }
                                    ]}
                                    onPress={handleManualAdd}
                                >
                                    <Text style={styles.actionButtonText}>Aggiungi</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={[styles.bonusOptionsList, { maxHeight: undefined }]}>
                                {bonusDefinitions.filter(d => d.type === bonusTypeTab).map((def) => (
                                    <TouchableOpacity
                                        key={def.id}
                                        style={[styles.bonusOption, { backgroundColor: theme.colors.inputBackground }]}
                                        onPress={() => handleSelectOption(def.points, def.label)}
                                    >
                                        <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{def.label}</Text>
                                        <Text style={[
                                            styles.optionPoints,
                                            def.points > 0 ? { color: theme.colors.success } : { color: theme.colors.danger }
                                        ]}>
                                            {def.points > 0 ? '+' : ''}{def.points}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.closeButton, { backgroundColor: theme.colors.primary, marginBottom: 20 }]}
                        onPress={onClose}
                    >
                        <Text style={styles.closeButtonText}>Chiudi</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};
