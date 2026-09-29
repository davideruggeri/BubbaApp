import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    subscribeToMembers,
    addMember,
    deleteMember,
    updateMember,
    Member,
    calculateMemberStreaks,
    MemberStreaks,
    subscribeToMemberTournaments,
    MemberTournament,
    getCachedStagioneCorrente
} from '../services/firestore';
import ScreenTitle from '../components/ScreenTitle';
import DatePickerModal from '../components/DatePickerModal';

import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { showAlert, showConfirmation } from '../utils/alert';

export default function DirectoryScreen() {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const { isStaff } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedMemberHistory, setSelectedMemberHistory] = useState<{
        member: Member;
        tournaments: MemberTournament[];
        streaks: MemberStreaks;
    } | null>(null);

    const [modalVisible, setModalVisible] = useState(false);

    const formatDate = (dateString: any) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    // Form State
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [nickname, setNickname] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [gender, setGender] = useState<'M' | 'F'>('M');
    const [jerseyNumber, setJerseyNumber] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeToMembers((updatedMembers) => {
            setMembers(updatedMembers);
        }, true); // Include inactive members in Directory

        return () => {
            unsubscribe();
        };
    }, []);

    const handleSaveMember = async () => {
        if (firstName.trim()) {
            if (editingMember) {
                showConfirmation(
                    "Conferma Modifica Membro",
                    `Vuoi salvare le modifiche per ${firstName} ${lastName}?`,
                    async () => {
                        try {
                            await updateMember({
                                ...editingMember,
                                firstName,
                                lastName,
                                nickname,
                                birthDate,
                                gender,
                                jerseyNumber,
                                inactiveSince: isActive ? null : (editingMember?.inactiveSince || new Date().toISOString().split('T')[0])
                            });
                            closeModal();
                            showAlert("Successo", "Dati membro aggiornati con successo.");
                        } catch (error) {
                            showAlert("Errore", "Impossibile salvare il membro. Controlla la connessione.");
                        }
                    },
                    "Salva Modifiche"
                );
                return;
            }

            try {
                await addMember(firstName, lastName, nickname, birthDate, gender, jerseyNumber);
                closeModal();
                showAlert("Successo", "Nuovo membro aggiunto con successo.");
            } catch (error) {
                showAlert("Errore", "Impossibile salvare il membro. Controlla la connessione.");
            }
        } else {
            showAlert("Attenzione", "Il nome è obbligatorio.");
        }
    };

    const handleDeleteMember = (id: string, name: string) => {
        showConfirmation(
            "Elimina Membro",
            `Sei sicuro di voler eliminare ${name}?`,
            async () => await deleteMember(id),
            "Elimina"
        );
    };

    const openAddModal = () => {
        setEditingMember(null);
        setFirstName('');
        setLastName('');
        setNickname('');
        setBirthDate('');
        setGender('M');
        setJerseyNumber('');
        setIsActive(true);
        setModalVisible(true);
    };

    const openEditModal = (member: Member) => {
        setEditingMember(member);
        setFirstName(member.firstName);
        setLastName(member.lastName || '');
        setNickname(member.nickname || '');
        setBirthDate(member.birthDate || '');
        setGender(member.gender || 'M');
        setJerseyNumber(member.jerseyNumber || '');
        setIsActive(!member.inactiveSince);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setEditingMember(null);
        setFirstName('');
        setLastName('');
        setNickname('');
        setBirthDate('');
        setGender('M');
        setJerseyNumber('');
        setIsActive(true);
    };

    const handleLongPress = async (member: Member) => {
        const season = getCachedStagioneCorrente();
        const streaks = await calculateMemberStreaks(member.id, season);
        const unsubscribeTournaments = subscribeToMemberTournaments(member.id, season, (tournaments) => {
            setSelectedMemberHistory({
                member,
                tournaments,
                streaks
            });
            unsubscribeTournaments();
        });
        setHistoryModalVisible(true);
    };

    const renderItem = ({ item }: { item: Member }) => (
        <TouchableOpacity onPress={() => isStaff && openEditModal(item)} onLongPress={() => handleLongPress(item)} delayLongPress={500} activeOpacity={isStaff ? 0.7 : 1}>
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, item.inactiveSince && styles.cardInactive]}>
                <View style={styles.info}>
                    <Text style={[styles.name, { color: theme.colors.text }]}>
                        {item.firstName} {item.lastName || ''}
                        {item.nickname ? <Text style={[styles.nickname, { color: theme.colors.textSecondary }]}> ({item.nickname})</Text> : ''}
                    </Text>
                    <Text style={[styles.details, { color: theme.colors.textSecondary }]}>
                        {item.gender === 'M' ? 'Uomo' : 'Donna'}
                        {item.birthDate ? ` • Nato il: ${formatDate(item.birthDate)}` : ''}
                    </Text>
                    {item.jerseyNumber ? <Text style={[styles.details, { color: theme.colors.textSecondary }]}>Maglia: #{item.jerseyNumber}</Text> : null}
                    {item.inactiveSince ? (
                        <Text style={[styles.details, { color: theme.colors.danger, fontWeight: 'bold' }]}>
                            INATTIVO dal {formatDate(item.inactiveSince)}
                        </Text>
                    ) : null}
                </View>
                {isStaff && (
                    <TouchableOpacity onPress={() => handleDeleteMember(item.id, `${item.firstName} ${item.lastName || ''}`)} style={[styles.deleteButton, { backgroundColor: theme.colors.inputBackground }]}>
                        <Text style={[styles.deleteButtonText, { color: theme.colors.danger }]}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <ScreenTitle title="INDIRIZZARIO" onBack={() => navigation.goBack()} />
                {isStaff && (
                    <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.primary }]} onPress={openAddModal}>
                        <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={members}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContainer}
                style={{ flex: 1, width: '100%' }}
                initialNumToRender={50}
            />

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.primary }]}>
                            {editingMember ? 'Modifica Membro' : 'Nuovo Membro'}
                        </Text>

                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            placeholder="Nome (Obbligatorio)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={firstName}
                            onChangeText={setFirstName}
                        />

                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            placeholder="Cognome (Opzionale)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={lastName}
                            onChangeText={setLastName}
                        />

                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            placeholder="Soprannome (Opzionale)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={nickname}
                            onChangeText={setNickname}
                        />

                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            placeholder="Numero Maglia (Opzionale)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={jerseyNumber}
                            onChangeText={(text) => setJerseyNumber(text.replace(/[^0-9]/g, ''))}
                            keyboardType="numeric"
                        />

                        <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                            <View style={[styles.input, { backgroundColor: theme.colors.inputBackground }]}>
                                <Text style={{ color: birthDate ? theme.colors.text : theme.colors.textSecondary }}>
                                    {birthDate ? `Data di Nascita: ${formatDate(birthDate)}` : 'Data di Nascita (Opzionale)'}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.genderContainer}>
                            <TouchableOpacity
                                style={[styles.genderButton, { borderColor: theme.colors.border }, gender === 'M' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                                onPress={() => setGender('M')}
                            >
                                <Text style={[styles.genderText, { color: theme.colors.text }, gender === 'M' && { color: '#fff' }]}>Uomo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.genderButton, { borderColor: theme.colors.border }, gender === 'F' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                                onPress={() => setGender('F')}
                            >
                                <Text style={[styles.genderText, { color: theme.colors.text }, gender === 'F' && { color: '#fff' }]}>Donna</Text>
                            </TouchableOpacity>
                        </View>

                        {editingMember && (
                            <TouchableOpacity
                                style={[styles.toggleButton, isActive ? { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.success } : { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.danger }]}
                                onPress={() => setIsActive(!isActive)}
                            >
                                <Text style={[styles.toggleButtonText, { color: isActive ? theme.colors.success : theme.colors.danger }]}>
                                    {isActive ? 'Membro Attivo' : 'Membro Inattivo'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                            onPress={handleSaveMember}
                        >
                            <Text style={styles.textStyle}>Salva</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={closeModal}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </Modal >

            {/* History Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={historyModalVisible}
                onRequestClose={() => setHistoryModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card, maxHeight: '80%' }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.primary, textAlign: 'center' }]}>
                            {selectedMemberHistory?.member.firstName} {selectedMemberHistory?.member.lastName || ''}
                        </Text>
                        {selectedMemberHistory?.member.nickname ? (
                            <Text style={{ fontStyle: 'italic', color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 15 }}>
                                "{selectedMemberHistory.member.nickname}"
                            </Text>
                        ) : null}

                        {/* Streaks & Presence Badges */}
                        <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginBottom: 10 }}>
                            <View style={{ flex: 1, backgroundColor: theme.colors.inputBackground, padding: 10, borderRadius: 12, alignItems: 'center' }}>
                                <Text style={{ fontSize: 18 }}>🔥</Text>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.primary }}>
                                    {selectedMemberHistory?.streaks?.currentStreak ?? (selectedMemberHistory?.member.currentStreak || 0)}
                                </Text>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Streak Attuale</Text>
                            </View>
                            <View style={{ flex: 1, backgroundColor: theme.colors.inputBackground, padding: 10, borderRadius: 12, alignItems: 'center' }}>
                                <Text style={{ fontSize: 18 }}>🏆</Text>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.primary }}>
                                    {selectedMemberHistory?.streaks?.streakMassima ?? (selectedMemberHistory?.member.streakMassima || 0)}
                                </Text>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Streak Record</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginBottom: 15 }}>
                            <View style={{ flex: 1, backgroundColor: theme.colors.inputBackground, padding: 8, borderRadius: 12, alignItems: 'center' }}>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                    {selectedMemberHistory?.member.attendanceCount || 0}
                                </Text>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Presenze Campo</Text>
                            </View>
                            <View style={{ flex: 1, backgroundColor: theme.colors.inputBackground, padding: 8, borderRadius: 12, alignItems: 'center' }}>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                    {selectedMemberHistory?.member.attendanceCountGym || 0}
                                </Text>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Presenze Palestra</Text>
                            </View>
                        </View>

                        <Text style={{ alignSelf: 'flex-start', fontWeight: 'bold', color: theme.colors.primary, marginBottom: 10, fontSize: 16 }}>
                            Tornei a Roster ({selectedMemberHistory?.tournaments?.length || 0}):
                        </Text>

                        {(!selectedMemberHistory?.tournaments || selectedMemberHistory.tournaments.length === 0) ? (
                            <Text style={{ color: theme.colors.textSecondary, marginBottom: 20, fontStyle: 'italic' }}>
                                Nessun torneo registrato a roster.
                            </Text>
                        ) : (
                            <FlatList
                                data={selectedMemberHistory?.tournaments}
                                keyExtractor={item => item.rosterId}
                                style={{ width: '100%', marginBottom: 15 }}
                                renderItem={({ item }) => (
                                    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 8, width: '100%' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.text }}>{item.title}</Text>
                                            <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '600' }}>{item.stagione}</Text>
                                        </View>
                                        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                            📅 {formatDate(item.date)} {item.location ? `• 📍 ${item.location}` : ''} • {item.role === 'player' ? 'Giocatore' : 'Ospite'}
                                        </Text>
                                    </View>
                                )}
                            />
                        )}

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setHistoryModalVisible(false)}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <DatePickerModal
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onSelectDate={setBirthDate}
                initialDate={birthDate}
            />
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        // padding: 20, // Removed to align back button with other screens
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginTop: 20, // Add some top margin if needed, or rely on SafeAreaView
        marginBottom: 10,
    },
    title: {
        // fontSize: 32,
        // fontWeight: 'bold',
        // color: '#003399',
        // fontFamily: 'NBAMilwaukeeBucks',
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
    addButtonText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    listContainer: {
        padding: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 18,
        color: '#333',
        fontWeight: '600',
    },
    nickname: {
        fontStyle: 'italic',
        color: '#666',
    },
    details: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    deleteButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#ffebee',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteButtonText: {
        color: '#d32f2f',
        fontWeight: 'bold',
        fontSize: 14,
    },
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        margin: 20,
        backgroundColor: "white",
        borderRadius: 20,
        padding: 35,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '80%',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#003399',
    },
    input: {
        width: '100%',
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
    },
    genderContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        width: '100%',
        justifyContent: 'space-between',
    },
    genderButton: {
        flex: 1,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
        marginHorizontal: 5,
    },
    genderButtonSelected: {
        backgroundColor: '#003399',
        borderColor: '#003399',
    },
    genderText: {
        color: '#333',
        fontWeight: 'bold',
    },
    genderTextSelected: {
        color: '#fff',
    },
    saveButton: {
        backgroundColor: "#003399",
        borderRadius: 20,
        padding: 10,
        elevation: 2,
        width: '100%',
        marginBottom: 10,
    },
    closeButton: {
        padding: 10,
    },
    textStyle: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center"
    },
    closeButtonText: {
        color: "#666",
        textAlign: "center"
    },
    cardInactive: {
        opacity: 0.5,
    },
    toggleButton: {
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
        borderWidth: 1,
    },
    activeButton: {
        backgroundColor: '#e8f5e9',
        borderColor: '#4caf50',
    },
    inactiveButton: {
        backgroundColor: '#ffebee',
        borderColor: '#f44336',
    },
    toggleButtonText: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#333',
    },
});
