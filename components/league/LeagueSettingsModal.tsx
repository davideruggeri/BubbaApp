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
import { LeagueRule, BonusDefinition, LeagueDates } from '../../services/firestore';
import { LeagueType, SettingsTab } from './leagueTypes';
import { leagueStyles as styles } from './leagueStyles';
import { useTheme } from '../../context/ThemeContext';
import { showAlert, showConfirmation } from '../../utils/alert';
import { saveLeagueRules, saveBonusDefinitions } from '../../services/firestore';

interface LeagueSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    leagueType: LeagueType;
    leagueDates: LeagueDates | null;
    rules: LeagueRule[];
    bonusDefinitions: BonusDefinition[];
    formatDateForDisplay: (date?: string | null) => string;
    onOpenStartPicker: () => void;
    onOpenEndPicker: () => void;
    datesInput: { startDate: string, endDate: string };
    onSaveDates: (dates: { startDate: string, endDate: string }, onSuccess?: () => void) => void;
}

export const LeagueSettingsModal: React.FC<LeagueSettingsModalProps> = ({
    visible,
    onClose,
    leagueType,
    rules,
    bonusDefinitions,
    formatDateForDisplay,
    onOpenStartPicker,
    onOpenEndPicker,
    datesInput,
    onSaveDates
}) => {
    const { theme } = useTheme();
    const [settingsTab, setSettingsTab] = useState<SettingsTab>('dates');

    const [localRules, setLocalRules] = useState<LeagueRule[]>([]);
    const [localBonusDefinitions, setLocalBonusDefinitions] = useState<BonusDefinition[]>([]);

    const [newRule, setNewRule] = useState({ title: '', description: '' });
    const [newBonusDef, setNewBonusDef] = useState({ label: '', points: '', type: 'bonus' as 'bonus' | 'malus' });

    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [editingRuleData, setEditingRuleData] = useState({ title: '', description: '' });
    const [editingBonusId, setEditingBonusId] = useState<string | null>(null);
    const [editingBonusData, setEditingBonusData] = useState({ label: '', points: '' });

    const [showAddRule, setShowAddRule] = useState(false);
    const [showAddBonus, setShowAddBonus] = useState(false);

    useEffect(() => {
        if (visible) {
            setLocalRules(JSON.parse(JSON.stringify(rules)));
            setLocalBonusDefinitions(JSON.parse(JSON.stringify(bonusDefinitions)));
            setEditingRuleId(null);
            setEditingBonusId(null);
            setShowAddRule(false);
            setShowAddBonus(false);
        }
    }, [visible, rules, bonusDefinitions]);

    const handleSaveRules = () => {
        showConfirmation(
            "Salva Regole Lega",
            `Vuoi salvare le modifiche alle regole del campionato ${leagueType === 'winter' ? 'Invernale' : 'Estivo'}?`,
            async () => {
                try {
                    await saveLeagueRules(leagueType, localRules);
                    onClose();
                    showAlert("Successo", "Regole salvate correttamente.");
                } catch (e) {
                    showAlert("Errore", "Impossibile salvare le regole.");
                }
            },
            "Salva"
        );
    };

    const handleSaveBonuses = () => {
        showConfirmation(
            "Salva Bonus Lega",
            `Vuoi salvare le modifiche ai bonus del campionato ${leagueType === 'winter' ? 'Invernale' : 'Estivo'}?`,
            async () => {
                try {
                    await saveBonusDefinitions(leagueType, localBonusDefinitions);
                    onClose();
                    showAlert("Successo", "Bonus salvati correttamente.");
                } catch (e) {
                    showAlert("Errore", "Impossibile salvare i bonus.");
                }
            },
            "Salva"
        );
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
                <View style={[styles.modalContent, { height: '80%', backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Impostazioni Lega</Text>

                    <View style={[styles.modalTabContainer, { borderBottomColor: theme.colors.border }]}>
                        <TouchableOpacity
                            style={[styles.modalTab, settingsTab === 'dates' && styles.modalTabActive]}
                            onPress={() => setSettingsTab('dates')}
                        >
                            <Text style={[styles.modalTabText, settingsTab === 'dates' && styles.modalTabTextActive, { color: settingsTab === 'dates' ? '#003399' : theme.colors.textSecondary }]}>Date</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalTab, settingsTab === 'rules' && styles.modalTabActive]}
                            onPress={() => setSettingsTab('rules')}
                        >
                            <Text style={[styles.modalTabText, settingsTab === 'rules' && styles.modalTabTextActive, { color: settingsTab === 'rules' ? '#003399' : theme.colors.textSecondary }]}>Regole</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalTab, settingsTab === 'bonus' && styles.modalTabActive]}
                            onPress={() => setSettingsTab('bonus')}
                        >
                            <Text style={[styles.modalTabText, settingsTab === 'bonus' && styles.modalTabTextActive, { color: settingsTab === 'bonus' ? '#003399' : theme.colors.textSecondary }]}>Bonus</Text>
                        </TouchableOpacity>
                    </View>

                    {settingsTab === 'dates' && (
                        <View style={{ flex: 1, justifyContent: 'space-between' }}>
                            <View>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Data Inizio:</Text>
                                <TouchableOpacity onPress={onOpenStartPicker} style={[styles.dateInput, { backgroundColor: theme.colors.inputBackground }]}>
                                    <Text style={{ color: theme.colors.text }}>{formatDateForDisplay(datesInput.startDate)}</Text>
                                </TouchableOpacity>

                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Data Fine:</Text>
                                <TouchableOpacity onPress={onOpenEndPicker} style={[styles.dateInput, { backgroundColor: theme.colors.inputBackground }]}>
                                    <Text style={{ color: theme.colors.text }}>{formatDateForDisplay(datesInput.endDate)}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.modalButtons, { marginTop: 'auto', paddingBottom: 10 }]}>
                                <TouchableOpacity style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={onClose}>
                                    <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.saveButton, { backgroundColor: theme.colors.primary }]} onPress={() => onSaveDates(datesInput, onClose)}>
                                    <Text style={styles.buttonText}>Salva</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {settingsTab === 'rules' && (
                        <View style={{ flex: 1 }}>
                            <ScrollView style={styles.rulesList}>
                                {localRules.map((rule) => (
                                    <View key={rule.id} style={[styles.ruleItem, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                                        {editingRuleId === rule.id ? (
                                            <View style={{ flex: 1 }}>
                                                <TextInput
                                                    style={[styles.input, { marginBottom: 5, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                    value={editingRuleData.title}
                                                    onChangeText={t => setEditingRuleData({ ...editingRuleData, title: t })}
                                                />
                                                <TextInput
                                                    style={[styles.input, { height: 60, textAlignVertical: 'top', backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                    multiline
                                                    value={editingRuleData.description}
                                                    onChangeText={t => setEditingRuleData({ ...editingRuleData, description: t })}
                                                />
                                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                                                    <TouchableOpacity onPress={() => setEditingRuleId(null)} style={{ marginRight: 15 }}>
                                                        <Text style={{ color: 'red' }}>Annulla</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => {
                                                        const updatedRules = localRules.map(r => r.id === rule.id ? { ...r, ...editingRuleData } : r);
                                                        setLocalRules(updatedRules);
                                                        setEditingRuleId(null);
                                                    }}>
                                                        <Text style={{ color: 'green', fontWeight: 'bold' }}>Salva</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.ruleTitle, { color: theme.colors.text }]}>{rule.title}</Text>
                                                    <Text style={[styles.ruleText, { color: theme.colors.textSecondary }]}>{rule.description}</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => {
                                                    setEditingRuleId(rule.id);
                                                    setEditingRuleData({ title: rule.title, description: rule.description });
                                                }} style={{ marginLeft: 10 }}>
                                                    <Text style={{ fontSize: 18, color: theme.colors.primary }}>✎</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => {
                                                    const updatedRules = localRules.filter(r => r.id !== rule.id);
                                                    setLocalRules(updatedRules);
                                                }} style={{ marginLeft: 10, backgroundColor: theme.colors.danger, borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' }}>
                                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>✕</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                ))}
                            </ScrollView>

                            {showAddRule && (
                                <View style={{ marginBottom: 10 }}>
                                    <View style={styles.customInputContainer}>
                                        <TextInput
                                            style={[styles.input, { flex: 1, marginRight: 5, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                            placeholder="Titolo Regola"
                                            placeholderTextColor={theme.colors.textSecondary}
                                            value={newRule.title}
                                            onChangeText={t => setNewRule({ ...newRule, title: t })}
                                        />
                                    </View>
                                    <TextInput
                                        style={[styles.input, { height: 60, textAlignVertical: 'top', marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                        placeholder="Descrizione Regola"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        multiline
                                        value={newRule.description}
                                        onChangeText={t => setNewRule({ ...newRule, description: t })}
                                    />
                                    <TouchableOpacity
                                        style={[styles.actionButton, { backgroundColor: theme.colors.primary, alignSelf: 'flex-end', width: '100%', borderRadius: 8 }]}
                                        onPress={() => {
                                            if (newRule.title.trim() && newRule.description.trim()) {
                                                setLocalRules([...localRules, { id: Date.now().toString(), ...newRule, order: localRules.length }]);
                                                setNewRule({ title: '', description: '' });
                                                setShowAddRule(false);
                                            }
                                        }}
                                    >
                                        <Text style={styles.actionButtonText}>Aggiungi Regola</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <TouchableOpacity
                                style={{ alignSelf: 'flex-end', padding: 10, marginBottom: 10 }}
                                onPress={() => setShowAddRule(!showAddRule)}
                            >
                                <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>
                                    {showAddRule ? '➖ Nascondi' : '➕ Nuova Regola'}
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={onClose}>
                                    <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveRules}>
                                    <Text style={styles.buttonText}>Salva</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {settingsTab === 'bonus' && (
                        <View style={{ flex: 1 }}>
                            <ScrollView style={styles.rulesList}>
                                {localBonusDefinitions.map((def) => (
                                    <View key={def.id} style={styles.bonusOption}>
                                        {editingBonusId === def.id ? (
                                            <View style={{ flex: 1 }}>
                                                <TextInput
                                                    style={[styles.input, { width: '100%', marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                    value={editingBonusData.label}
                                                    onChangeText={t => setEditingBonusData({ ...editingBonusData, label: t })}
                                                    placeholder="Nome Bonus"
                                                    placeholderTextColor={theme.colors.textSecondary}
                                                />
                                                <TextInput
                                                    style={[styles.input, { width: '100%', marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                                    value={editingBonusData.points}
                                                    keyboardType="numeric"
                                                    onChangeText={t => setEditingBonusData({ ...editingBonusData, points: t })}
                                                    placeholder="Punti"
                                                    placeholderTextColor={theme.colors.textSecondary}
                                                />
                                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 5 }}>
                                                    <TouchableOpacity onPress={() => setEditingBonusId(null)} style={{ marginRight: 15 }}>
                                                        <Text style={{ color: 'red' }}>Annulla</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => {
                                                        const points = parseInt(editingBonusData.points, 10);
                                                        if (!isNaN(points) && editingBonusData.label.trim()) {
                                                            const updatedBonus = localBonusDefinitions.map(b => b.id === def.id ? { ...b, label: editingBonusData.label, points, type: points >= 0 ? 'bonus' : 'malus' as 'bonus' | 'malus' } : b);
                                                            setLocalBonusDefinitions(updatedBonus);
                                                            setEditingBonusId(null);
                                                        }
                                                    }}>
                                                        <Text style={{ color: 'green', fontWeight: 'bold' }}>OK</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <>
                                                <Text style={[styles.optionLabel, { flex: 1, color: theme.colors.text }]}>{def.label}</Text>
                                                <Text style={[styles.optionPoints, def.points > 0 ? { color: theme.colors.success } : { color: theme.colors.danger }]}>
                                                    {def.points > 0 ? '+' : ''}{def.points}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setEditingBonusId(def.id);
                                                        setEditingBonusData({ label: def.label, points: def.points.toString() });
                                                    }}
                                                    style={{ marginLeft: 10, marginRight: 10 }}
                                                >
                                                    <Text style={{ fontSize: 18, color: theme.colors.primary }}>✎</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => {
                                                    const updatedBonus = localBonusDefinitions.filter(b => b.id !== def.id);
                                                    setLocalBonusDefinitions(updatedBonus);
                                                }} style={{ marginLeft: 10, backgroundColor: theme.colors.danger, borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' }}>
                                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>✕</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                ))}
                            </ScrollView>

                            {showAddBonus && (
                                <View style={{ marginBottom: 10 }}>
                                    <TextInput
                                        style={[styles.input, { width: '100%', marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                        placeholder="Nome Bonus"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        value={newBonusDef.label}
                                        onChangeText={t => setNewBonusDef({ ...newBonusDef, label: t })}
                                    />
                                    <TextInput
                                        style={[styles.input, { width: '100%', marginBottom: 10, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                        placeholder="Punti (es. 2 o -1)"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        keyboardType="numeric"
                                        value={newBonusDef.points}
                                        onChangeText={t => setNewBonusDef({ ...newBonusDef, points: t })}
                                    />
                                    <TouchableOpacity
                                        style={[styles.actionButton, { backgroundColor: theme.colors.primary, alignSelf: 'flex-end', width: '100%', borderRadius: 8, height: 50, marginLeft: 0 }]}
                                        onPress={() => {
                                            if (newBonusDef.label.trim() && newBonusDef.points) {
                                                const points = parseInt(newBonusDef.points, 10);
                                                const newBonusObj: BonusDefinition = {
                                                    id: Date.now().toString(),
                                                    label: newBonusDef.label,
                                                    points,
                                                    type: points >= 0 ? 'bonus' : 'malus'
                                                };
                                                setLocalBonusDefinitions([...localBonusDefinitions, newBonusObj]);
                                                setNewBonusDef({ label: '', points: '', type: 'bonus' });
                                                setShowAddBonus(false);
                                            }
                                        }}
                                    >
                                        <Text style={styles.actionButtonText}>Aggiungi Bonus</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <TouchableOpacity
                                style={{ alignSelf: 'flex-end', padding: 10, marginBottom: 10 }}
                                onPress={() => setShowAddBonus(!showAddBonus)}
                            >
                                <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>
                                    {showAddBonus ? '➖ Nascondi' : '➕ Nuovo Bonus'}
                                </Text>
                            </TouchableOpacity>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={onClose}>
                                    <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveBonuses}>
                                    <Text style={styles.buttonText}>Salva</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};
