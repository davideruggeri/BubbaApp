import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, FlatList, Image, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenTitle from '../components/ScreenTitle';
import { useTheme } from '../context/ThemeContext';
import { subscribeToMatchAnalysis, addMatchAnalysis, MatchAnalysis, deleteMatchAnalysis, updateMatchAnalysis } from '../services/firestore';
import DatePickerModal from '../components/DatePickerModal';
import { showAlert, showConfirmation } from '../utils/alert';
import { useAuth } from '../context/AuthContext';

export default function AnalisiPartitaScreen() {
    const { theme } = useTheme();
    const { isStaff } = useAuth();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [matches, setMatches] = useState<MatchAnalysis[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Form State
    const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
    const [opponent, setOpponent] = useState('');
    const [surface, setSurface] = useState<'sabbia' | 'erba'>('sabbia');
    const [division, setDivision] = useState<'open' | 'mixed'>('open');
    const [startingGender, setStartingGender] = useState<'M' | 'F'>('M');
    const [date, setDate] = useState(''); // Stores YYYY-MM-DD
    const [timeoutType, setTimeoutType] = useState<'standard_half' | 'standard_match' | 'custom'>('standard_match');
    const [customTimeoutCount, setCustomTimeoutCount] = useState('1');
    const [customTimeoutScope, setCustomTimeoutScope] = useState<'half' | 'match'>('match');

    useEffect(() => {
        const unsubscribe = subscribeToMatchAnalysis(setMatches);
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setEditingMatchId(null);
        setOpponent('');
        setSurface('sabbia');
        setDivision('open');
        setStartingGender('M');
        // Default to today YYYY-MM-DD
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        setDate(`${year}-${month}-${day}`);
        setDate(`${year}-${month}-${day}`);
        setTimeoutType('standard_match');
        setCustomTimeoutCount('1');
        setCustomTimeoutScope('match');
        setModalVisible(false);
    };

    const handleSaveMatch = async () => {
        if (!opponent.trim()) {
            showAlert("Errore", "Inserisci il nome della squadra avversaria.");
            return;
        }

        try {
            const targetScore = (surface === 'sabbia' ? 13 : 15) as 13 | 15;

            const matchData: any = {
                opponent: opponent.trim(),
                surface,
                division,
                targetScore,
                date: date, // Already YYYY-MM-DD
                rules: {
                    timeoutLimit: timeoutType === 'custom'
                        ? { count: parseInt(customTimeoutCount) || 1, scope: customTimeoutScope }
                        : (timeoutType === 'standard_half' ? '1_per_half' : '1_per_match'),
                    scoreLimit: 'standard',
                    halftimeMode: 'standard'
                }
            };

            if (division === 'mixed') {
                matchData.startingGender = startingGender;
            }

            if (editingMatchId) {
                await updateMatchAnalysis({ id: editingMatchId, ...matchData });
            } else {
                await addMatchAnalysis({
                    ...matchData,
                    ourScore: 0,
                    theirScore: 0
                });
            }
            resetForm();
        } catch (error) {
            showAlert("Errore", "Impossibile salvare la partita.");
        }
    };

    const handleEditMatch = (match: MatchAnalysis) => {
        setEditingMatchId(match.id);
        setOpponent(match.opponent);
        setSurface(match.surface);
        setDivision(match.division);
        setDate(match.date); // Already YYYY-MM-DD

        if (match.startingGender) setStartingGender(match.startingGender);
        if (match.startingGender) setStartingGender(match.startingGender);

        // Parse Timeout Rules
        const limit = match.rules?.timeoutLimit;
        if (typeof limit === 'object' && limit !== null) {
            setTimeoutType('custom');
            setCustomTimeoutCount(limit.count.toString());
            setCustomTimeoutScope(limit.scope);
        } else if (limit === '1_per_half') {
            setTimeoutType('standard_half');
        } else {
            setTimeoutType('standard_match');
        }

        setModalVisible(true);
    };

    const handleDeleteMatch = (id: string) => {
        showConfirmation(
            "Elimina Partita",
            "Sei sicuro di voler eliminare questa partita?",
            () => deleteMatchAnalysis(id),
            "Elimina"
        );
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const MatchCard = ({ item, theme, navigation, onEdit, onDelete, formatDate }: any) => {
        // Animation for live indicator
        const fadeAnim = useRef(new Animated.Value(0)).current;

        useEffect(() => {
            if (item.status === 'live') {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(fadeAnim, {
                            toValue: 1,
                            duration: 800,
                            useNativeDriver: true,
                        }),
                        Animated.timing(fadeAnim, {
                            toValue: 0,
                            duration: 800,
                            useNativeDriver: true,
                        }),
                    ])
                ).start();
            }
        }, [item.status]);

        return (
            <View style={[styles.matchCard, { backgroundColor: theme.colors.card }]}>
                <TouchableOpacity
                    style={styles.cardContent}
                    onPress={() => navigation.navigate('MatchDetail', { match: item })}
                >
                    <View style={styles.matchHeader}>
                        <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
                            {formatDate(item.date)}
                        </Text>
                        {item.status === 'live' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Animated.View
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: 'red',
                                        marginRight: 5,
                                        opacity: fadeAnim
                                    }}
                                />
                                <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 12 }}>LIVE</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.matchBody}>
                        <Text style={[styles.opponentText, { color: theme.colors.text }]}>Bubba vs {item.opponent}</Text>
                        <View style={styles.matchDetails}>
                            <Text style={[styles.detailBadge, { backgroundColor: item.surface === 'sabbia' ? '#ffe0b2' : '#c8e6c9', color: '#333' }]}>
                                {item.surface === 'sabbia' ? '🏖️ Sabbia' : '🌱 Erba'}
                            </Text>
                            <Text style={[styles.detailBadge, { backgroundColor: '#e3f2fd', color: '#333' }]}>
                                {item.division === 'open' ? '🔓 Open' : '👫 Mixed'}
                            </Text>
                            {item.division === 'mixed' && item.startingGender && (
                                <Text style={[styles.detailBadge, { backgroundColor: item.startingGender === 'M' ? '#e3f2fd' : '#fce4ec', color: '#333' }]}>
                                    Gen: {item.startingGender}
                                </Text>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>



                {
                    isStaff && (
                        <View style={[styles.cardActions, { borderTopColor: theme.colors.border }]}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => onEdit(item)}>
                                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Modifica</Text>
                            </TouchableOpacity>
                            <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                            <TouchableOpacity style={styles.actionButton} onPress={() => onDelete(item.id)}>
                                <Text style={{ color: theme.colors.danger, fontWeight: '600' }}>Elimina</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }
            </View >
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <ScreenTitle title="ANALISI PARTITA" onBack={() => navigation.goBack()} />
                {isStaff && (
                    <TouchableOpacity style={styles.addButton} onPress={() => { resetForm(); setModalVisible(true); }}>
                        <Image source={require('../assets/plus.png')} style={styles.addIcon} />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={matches}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <MatchCard
                        item={item}
                        theme={theme}
                        navigation={navigation}
                        onEdit={handleEditMatch}
                        onDelete={handleDeleteMatch}
                        formatDate={formatDate}
                    />
                )}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessuna partita registrata.</Text>
                }
            />

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={resetForm}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            {editingMatchId ? "Modifica Partita" : "Nuova Partita"}
                        </Text>

                        <Text style={[styles.label, { color: theme.colors.text }]}>Avversario</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Nome Squadra"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={opponent}
                            onChangeText={setOpponent}
                        />

                        <Text style={[styles.label, { color: theme.colors.text }]}>Data</Text>
                        <TouchableOpacity
                            onPress={() => setShowDatePicker(true)}
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, justifyContent: 'center' }]}
                        >
                            <Text style={{ color: theme.colors.text }}>
                                {date ? formatDate(date) : 'Seleziona Data'}
                            </Text>
                        </TouchableOpacity>

                        <Text style={[styles.label, { color: theme.colors.text }]}>Superficie</Text>
                        <View style={styles.toggleContainer}>
                            <TouchableOpacity
                                style={[styles.toggleButton, surface === 'sabbia' && styles.toggleButtonActive]}
                                onPress={() => setSurface('sabbia')}
                            >
                                <Text style={[styles.toggleText, surface === 'sabbia' && styles.toggleTextActive]}>🏖️ Sabbia</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleButton, surface === 'erba' && styles.toggleButtonActive]}
                                onPress={() => setSurface('erba')}
                            >
                                <Text style={[styles.toggleText, surface === 'erba' && styles.toggleTextActive]}>🌱 Erba</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.label, { color: theme.colors.text }]}>Divisione</Text>
                        <View style={styles.toggleContainer}>
                            <TouchableOpacity
                                style={[styles.toggleButton, division === 'open' && styles.toggleButtonActive]}
                                onPress={() => setDivision('open')}
                            >
                                <Text style={[styles.toggleText, division === 'open' && styles.toggleTextActive]}>🔓 Open</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleButton, division === 'mixed' && styles.toggleButtonActive]}
                                onPress={() => setDivision('mixed')}
                            >
                                <Text style={[styles.toggleText, division === 'mixed' && styles.toggleTextActive]}>👫 Mixed</Text>
                            </TouchableOpacity>
                        </View>

                        {division === 'mixed' && (
                            <>
                                <Text style={[styles.label, { color: theme.colors.text }]}>Gender Inizio</Text>
                                <View style={styles.toggleContainer}>
                                    <TouchableOpacity
                                        style={[styles.toggleButton, startingGender === 'M' && styles.toggleButtonActive]}
                                        onPress={() => setStartingGender('M')}
                                    >
                                        <Text style={[styles.toggleText, startingGender === 'M' && styles.toggleTextActive]}>Uomo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.toggleButton, startingGender === 'F' && styles.toggleButtonActive]}
                                        onPress={() => setStartingGender('F')}
                                    >
                                        <Text style={[styles.toggleText, startingGender === 'F' && styles.toggleTextActive]}>Donna</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}

                        <Text style={[styles.label, { color: theme.colors.text }]}>Timeouts</Text>
                        <View style={styles.toggleContainer}>
                            <TouchableOpacity
                                style={[styles.toggleButton, timeoutType === 'standard_match' && styles.toggleButtonActive]}
                                onPress={() => setTimeoutType('standard_match')}
                            >
                                <Text style={[styles.toggleText, timeoutType === 'standard_match' && styles.toggleTextActive]}>1 / Partita</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleButton, timeoutType === 'standard_half' && styles.toggleButtonActive]}
                                onPress={() => setTimeoutType('standard_half')}
                            >
                                <Text style={[styles.toggleText, timeoutType === 'standard_half' && styles.toggleTextActive]}>1 / Tempo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleButton, timeoutType === 'custom' && styles.toggleButtonActive]}
                                onPress={() => setTimeoutType('custom')}
                            >
                                <Text style={[styles.toggleText, timeoutType === 'custom' && styles.toggleTextActive]}>Custom</Text>
                            </TouchableOpacity>
                        </View>

                        {timeoutType === 'custom' && (
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: theme.colors.text, marginTop: 0 }]}>Numero</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                                        keyboardType="numeric"
                                        value={customTimeoutCount}
                                        onChangeText={setCustomTimeoutCount}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: theme.colors.text, marginTop: 0 }]}>Ogni</Text>
                                    <View style={{ flexDirection: 'row', gap: 5 }}>
                                        <TouchableOpacity
                                            style={[styles.toggleButton, customTimeoutScope === 'match' && styles.toggleButtonActive, { padding: 8 }]}
                                            onPress={() => setCustomTimeoutScope('match')}
                                        >
                                            <Text style={[styles.toggleText, customTimeoutScope === 'match' && styles.toggleTextActive, { fontSize: 12 }]}>Partita</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.toggleButton, customTimeoutScope === 'half' && styles.toggleButtonActive, { padding: 8 }]}
                                            onPress={() => setCustomTimeoutScope('half')}
                                        >
                                            <Text style={[styles.toggleText, customTimeoutScope === 'half' && styles.toggleTextActive, { fontSize: 12 }]}>Tempo</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={resetForm}
                            >
                                <Text style={styles.cancelButtonText}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.saveButton]}
                                onPress={handleSaveMatch}
                            >
                                <Text style={styles.saveButtonText}>Salva</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <DatePickerModal
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onSelectDate={setDate}
                initialDate={date}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        position: 'relative',
    },
    addButton: {
        position: 'absolute',
        right: 20,
        backgroundColor: '#003399',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addIcon: {
        width: 20,
        height: 20,
        tintColor: '#fff',
        resizeMode: 'contain',
    },
    listContent: {
        padding: 20,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        fontStyle: 'italic',
    },
    matchCard: {
        borderRadius: 12,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        overflow: 'hidden',
    },
    cardContent: {
        padding: 15,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    dateText: {
        fontSize: 12,
    },
    matchBody: {
        marginTop: 5,
    },
    opponentText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    matchDetails: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    detailBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        fontSize: 12,
        fontWeight: '600',
        overflow: 'hidden',
    },
    cardActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
    },
    actionButton: {
        flex: 1,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    separator: {
        width: 1,
        height: '100%',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 5,
        marginTop: 10,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 16,
        height: 50, // Fixed height for consistency
    },
    toggleContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    toggleButton: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
    },
    toggleButtonActive: {
        backgroundColor: '#e3f2fd',
        borderColor: '#003399',
    },
    toggleText: {
        color: '#666',
        fontWeight: '600',
    },
    toggleTextActive: {
        color: '#003399',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 25,
        gap: 10,
    },
    button: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f5f5f5',
    },
    saveButton: {
        backgroundColor: '#003399',
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: 'bold',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
