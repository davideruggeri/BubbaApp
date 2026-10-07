import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    subscribeToMembers,
    addMember,
    deleteMember,
    updateMember,
    Member,
    InactivityPeriod,
    isMemberCurrentlyActive,
    isMemberActiveAtDate,
    calculateMemberStreaks,
    MemberStreaks,
    subscribeToMemberTournaments,
    MemberTournament,
    getCachedStagioneCorrente
} from '../services/firestore';
import { calculateMemberBadges, UserBadgeProgress } from '../services/firestore/badges';
import BadgesSection from '../components/BadgesSection';
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
    const [selectedMemberBadges, setSelectedMemberBadges] = useState<UserBadgeProgress[]>([]);
    const [loadingBadges, setLoadingBadges] = useState(false);

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
    const [inactivityStartDate, setInactivityStartDate] = useState('');
    const [inactivityEndDate, setInactivityEndDate] = useState('');
    const [inactivityReason, setInactivityReason] = useState('');
    const [inactivityPeriods, setInactivityPeriods] = useState<InactivityPeriod[]>([]);
    const [datePickerTarget, setDatePickerTarget] = useState<'birthDate' | 'inactivityStart' | 'inactivityEnd' | null>(null);

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
                            const today = new Date().toISOString().split('T')[0];
                            let updatedPeriods = [...inactivityPeriods];
                            let newInactiveSince: string | null = null;

                            if (!isActive) {
                                const sDate = inactivityStartDate || today;
                                const eDate = inactivityEndDate.trim() || null;
                                const reason = inactivityReason.trim();

                                const openIdx = updatedPeriods.findIndex(p => !p.endDate || p.endDate >= today);
                                if (openIdx >= 0) {
                                    updatedPeriods[openIdx] = {
                                        ...updatedPeriods[openIdx],
                                        startDate: sDate,
                                        endDate: eDate,
                                        reason: reason || updatedPeriods[openIdx].reason || ''
                                    };
                                } else {
                                    updatedPeriods.push({
                                        id: `inact_${Date.now()}`,
                                        startDate: sDate,
                                        endDate: eDate,
                                        reason
                                    });
                                }

                                const isNowInactive = sDate <= today && (!eDate || eDate >= today);
                                newInactiveSince = isNowInactive ? sDate : null;
                            } else {
                                // Riattivazione: chiude periodi aperti salvando la data odierna come termine
                                if (updatedPeriods.length > 0) {
                                    updatedPeriods = updatedPeriods.map(p => {
                                        if (!p.endDate || p.endDate > today) {
                                            return { ...p, endDate: today };
                                        }
                                        return p;
                                    });
                                } else if (editingMember?.inactiveSince) {
                                    updatedPeriods.push({
                                        id: `inact_${Date.now()}`,
                                        startDate: editingMember.inactiveSince,
                                        endDate: today,
                                        reason: 'Inattività passata'
                                    });
                                }
                                newInactiveSince = null;
                            }

                            await updateMember({
                                ...editingMember,
                                firstName,
                                lastName,
                                nickname,
                                birthDate,
                                gender,
                                jerseyNumber,
                                inactiveSince: newInactiveSince,
                                inactivityPeriods: updatedPeriods
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
        setInactivityStartDate('');
        setInactivityEndDate('');
        setInactivityReason('');
        setInactivityPeriods([]);
        setDatePickerTarget(null);
        setModalVisible(true);
    };

    const openEditModal = (member: Member) => {
        const currentlyActive = isMemberCurrentlyActive(member);
        const periods = member.inactivityPeriods ? [...member.inactivityPeriods] : [];
        const today = new Date().toISOString().split('T')[0];
        const activePeriod = periods.find(p => p.startDate <= today && (!p.endDate || p.endDate >= today))
            || (periods.length > 0 ? periods[periods.length - 1] : null);

        setEditingMember(member);
        setFirstName(member.firstName);
        setLastName(member.lastName || '');
        setNickname(member.nickname || '');
        setBirthDate(member.birthDate || '');
        setGender(member.gender || 'M');
        setJerseyNumber(member.jerseyNumber || '');
        setIsActive(currentlyActive);
        setInactivityStartDate(activePeriod?.startDate || member.inactiveSince || today);
        setInactivityEndDate(activePeriod?.endDate || '');
        setInactivityReason(activePeriod?.reason || '');
        setInactivityPeriods(periods);
        setDatePickerTarget(null);
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
        setInactivityStartDate('');
        setInactivityEndDate('');
        setInactivityReason('');
        setInactivityPeriods([]);
        setDatePickerTarget(null);
    };

    const handleLongPress = async (member: Member) => {
        const season = getCachedStagioneCorrente();
        const streaks = await calculateMemberStreaks(member.id, 'all');
        const unsubscribeTournaments = subscribeToMemberTournaments(member.id, season, (tournaments) => {
            setSelectedMemberHistory({
                member,
                tournaments,
                streaks
            });
            unsubscribeTournaments();
        });
        setLoadingBadges(true);
        calculateMemberBadges(member.id)
            .then(b => setSelectedMemberBadges(b))
            .catch(e => console.error("Error loading badges:", e))
            .finally(() => setLoadingBadges(false));
        setHistoryModalVisible(true);
    };

    const renderItem = ({ item }: { item: Member }) => {
        const isCurrentActive = isMemberCurrentlyActive(item);
        const today = new Date().toISOString().split('T')[0];
        const currentPeriod = item.inactivityPeriods?.find(p => p.startDate <= today && (!p.endDate || p.endDate >= today));

        return (
            <TouchableOpacity onPress={() => isStaff && openEditModal(item)} onLongPress={() => handleLongPress(item)} delayLongPress={500} activeOpacity={isStaff ? 0.7 : 1}>
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, !isCurrentActive && styles.cardInactive]}>
                    <View style={styles.info}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}>
                            <Text style={[styles.name, { color: theme.colors.text }]}>
                                {item.firstName} {item.lastName || ''}
                                {item.nickname ? <Text style={[styles.nickname, { color: theme.colors.textSecondary }]}> ({item.nickname})</Text> : ''}
                            </Text>
                            {!isCurrentActive && (
                                <View style={{ backgroundColor: theme.colors.danger + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                                    <Text style={{ color: theme.colors.danger, fontSize: 11, fontWeight: 'bold' }}>⏸️ IN PAUSA</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.details, { color: theme.colors.textSecondary }]}>
                            {item.gender === 'M' ? 'Uomo' : 'Donna'}
                            {item.birthDate ? ` • Nato il: ${formatDate(item.birthDate)}` : ''}
                        </Text>
                        {item.jerseyNumber ? <Text style={[styles.details, { color: theme.colors.textSecondary }]}>Maglia: #{item.jerseyNumber}</Text> : null}
                        {!isCurrentActive ? (
                            <Text style={[styles.details, { color: theme.colors.danger, fontWeight: '600', marginTop: 4 }]}>
                                Pausa: dal {formatDate(currentPeriod?.startDate || item.inactiveSince)}
                                {currentPeriod?.endDate ? ` al ${formatDate(currentPeriod.endDate)}` : ' (in corso)'}
                                {currentPeriod?.reason ? ` • ${currentPeriod.reason}` : ''}
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
    };

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
                        <ScrollView style={{ width: '100%', maxHeight: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
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

                            <TouchableOpacity onPress={() => setDatePickerTarget('birthDate')} style={{ width: '100%' }}>
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

                            {/* Stato Presenza / Inattività */}
                            {editingMember && (
                                <View style={{ width: '100%', marginBottom: 15 }}>
                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 8 }}>
                                        Stato Disponibilità:
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                        <TouchableOpacity
                                            style={[
                                                styles.statusTabButton,
                                                { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground },
                                                isActive && { backgroundColor: theme.colors.success + '22', borderColor: theme.colors.success }
                                            ]}
                                            onPress={() => setIsActive(true)}
                                        >
                                            <Text style={[styles.statusTabText, { color: theme.colors.textSecondary }, isActive && { color: theme.colors.success, fontWeight: 'bold' }]}>
                                                🟢 Attivo
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.statusTabButton,
                                                { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground },
                                                !isActive && { backgroundColor: theme.colors.danger + '22', borderColor: theme.colors.danger }
                                            ]}
                                            onPress={() => setIsActive(false)}
                                        >
                                            <Text style={[styles.statusTabText, { color: theme.colors.textSecondary }, !isActive && { color: theme.colors.danger, fontWeight: 'bold' }]}>
                                                ⏸️ In Pausa
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {!isActive ? (
                                        <View style={[styles.inactivityBox, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 }}>
                                                Configura Periodo di Pausa
                                            </Text>

                                            {/* Data Inizio */}
                                            <TouchableOpacity
                                                onPress={() => setDatePickerTarget('inactivityStart')}
                                                style={[styles.datePickerField, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                                            >
                                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Data Inizio Pausa:</Text>
                                                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text, marginTop: 2 }}>
                                                    📅 {formatDate(inactivityStartDate) || 'Seleziona data inizio'}
                                                </Text>
                                            </TouchableOpacity>

                                            {/* Data Fine (Rientro) */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                                <TouchableOpacity
                                                    onPress={() => setDatePickerTarget('inactivityEnd')}
                                                    style={[styles.datePickerField, { flex: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                                                >
                                                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Rientro Previsto (Opzionale):</Text>
                                                    <Text style={{ fontSize: 14, fontWeight: '600', color: inactivityEndDate ? theme.colors.text : theme.colors.textSecondary, marginTop: 2 }}>
                                                        {inactivityEndDate ? `📅 ${formatDate(inactivityEndDate)}` : 'In corso (Nessun rientro fissato)'}
                                                    </Text>
                                                </TouchableOpacity>
                                                {inactivityEndDate ? (
                                                    <TouchableOpacity
                                                        onPress={() => setInactivityEndDate('')}
                                                        style={{ padding: 10, backgroundColor: theme.colors.card, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}
                                                    >
                                                        <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: 'bold' }}>✕</Text>
                                                    </TouchableOpacity>
                                                ) : null}
                                            </View>

                                            {/* Motivi Rapidi */}
                                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 10, marginBottom: 6 }}>
                                                Motivo principale:
                                            </Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                                {['Infortunio', 'Studio/Erasmus', 'Lavoro', 'Pausa', 'Altro'].map((preset) => (
                                                    <TouchableOpacity
                                                        key={preset}
                                                        onPress={() => setInactivityReason(preset)}
                                                        style={[
                                                            styles.presetChip,
                                                            { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
                                                            inactivityReason === preset && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                                                        ]}
                                                    >
                                                        <Text style={[styles.presetChipText, { color: theme.colors.textSecondary }, inactivityReason === preset && { color: '#fff', fontWeight: 'bold' }]}>
                                                            {preset}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            <TextInput
                                                style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, marginBottom: 0, padding: 10, fontSize: 13 }]}
                                                placeholder="Note aggiuntive (opzionale)..."
                                                placeholderTextColor={theme.colors.textSecondary}
                                                value={inactivityReason}
                                                onChangeText={setInactivityReason}
                                            />
                                        </View>
                                    ) : (
                                        <View style={{ backgroundColor: theme.colors.success + '15', padding: 10, borderRadius: 10, marginBottom: 5 }}>
                                            <Text style={{ fontSize: 12, color: theme.colors.success, textAlign: 'center' }}>
                                                ✓ Giocatore attivo. Tutti i dati storici, presenze e streak sono mantenuti.
                                            </Text>
                                        </View>
                                    )}

                                    {/* Elenco Periodi di Inattività Passati */}
                                    {inactivityPeriods.length > 0 && (
                                        <View style={{ marginTop: 10 }}>
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 6 }}>
                                                Storico Pause Registrate ({inactivityPeriods.length}):
                                            </Text>
                                            {inactivityPeriods.map((p, pIdx) => (
                                                <View key={p.id || pIdx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 12, color: theme.colors.text, fontWeight: '600' }}>
                                                            {formatDate(p.startDate)} → {p.endDate ? formatDate(p.endDate) : 'In corso'}
                                                        </Text>
                                                        {p.reason ? <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{p.reason}</Text> : null}
                                                    </View>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            const updated = inactivityPeriods.filter((_, idx) => idx !== pIdx);
                                                            setInactivityPeriods(updated);
                                                        }}
                                                        style={{ padding: 4 }}
                                                    >
                                                        <Text style={{ color: theme.colors.danger, fontSize: 12 }}>🗑️</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
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
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* History Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={historyModalVisible}
                onRequestClose={() => setHistoryModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: theme.colors.card, maxHeight: '85%' }]}>
                        <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 15 }} showsVerticalScrollIndicator={false}>
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

                            {/* Badges Section */}
                            <BadgesSection badges={selectedMemberBadges} loading={loadingBadges} />

                            {/* Sezione Tornei */}
                            <Text style={{ alignSelf: 'flex-start', fontWeight: 'bold', color: theme.colors.primary, marginTop: 10, marginBottom: 8, fontSize: 16 }}>
                                Tornei a Roster ({selectedMemberHistory?.tournaments?.length || 0}):
                            </Text>

                            {(!selectedMemberHistory?.tournaments || selectedMemberHistory.tournaments.length === 0) ? (
                                <Text style={{ color: theme.colors.textSecondary, marginBottom: 15, fontStyle: 'italic', alignSelf: 'flex-start' }}>
                                    Nessun torneo registrato a roster.
                                </Text>
                            ) : (
                                <View style={{ width: '100%', marginBottom: 15 }}>
                                    {selectedMemberHistory.tournaments.map((item) => (
                                        <View key={item.rosterId} style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 8, width: '100%' }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.text }}>{item.title}</Text>
                                                <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '600' }}>{item.stagione}</Text>
                                            </View>
                                            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                                📅 {formatDate(item.date)} {item.location ? `• 📍 ${item.location}` : ''} • {item.role === 'player' ? 'Giocatore' : 'Ospite'}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Sezione Storico Pause / Inattività */}
                            <Text style={{ alignSelf: 'flex-start', fontWeight: 'bold', color: theme.colors.primary, marginTop: 10, marginBottom: 8, fontSize: 16 }}>
                                ⏸️ Storico Pause / Inattività ({selectedMemberHistory?.member.inactivityPeriods?.length || (selectedMemberHistory?.member.inactiveSince ? 1 : 0)}):
                            </Text>

                            {(!selectedMemberHistory?.member.inactivityPeriods || selectedMemberHistory.member.inactivityPeriods.length === 0) && !selectedMemberHistory?.member.inactiveSince ? (
                                <Text style={{ color: theme.colors.textSecondary, marginBottom: 20, fontStyle: 'italic', alignSelf: 'flex-start' }}>
                                    Nessun periodo di inattività registrato.
                                </Text>
                            ) : (
                                <View style={{ width: '100%', marginBottom: 20 }}>
                                    {selectedMemberHistory?.member.inactivityPeriods && selectedMemberHistory.member.inactivityPeriods.length > 0 ? (
                                        selectedMemberHistory.member.inactivityPeriods.map((p, pIdx) => (
                                            <View key={p.id || pIdx} style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 8, width: '100%' }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                                        {formatDate(p.startDate)} → {p.endDate ? formatDate(p.endDate) : 'In corso'}
                                                    </Text>
                                                    <View style={{ backgroundColor: p.endDate ? theme.colors.inputBackground : theme.colors.danger + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                        <Text style={{ fontSize: 11, color: p.endDate ? theme.colors.textSecondary : theme.colors.danger, fontWeight: 'bold' }}>
                                                            {p.endDate ? 'Terminata' : 'In corso'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                {p.reason ? (
                                                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                                                        Motivo: {p.reason}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        ))
                                    ) : (
                                        <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 8, width: '100%' }}>
                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>
                                                Dal {formatDate(selectedMemberHistory?.member.inactiveSince)} → In corso
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setHistoryModalVisible(false)}
                            >
                                <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <DatePickerModal
                visible={datePickerTarget !== null}
                onClose={() => setDatePickerTarget(null)}
                onSelectDate={(date) => {
                    if (datePickerTarget === 'birthDate') setBirthDate(date);
                    else if (datePickerTarget === 'inactivityStart') setInactivityStartDate(date);
                    else if (datePickerTarget === 'inactivityEnd') setInactivityEndDate(date);
                    setDatePickerTarget(null);
                }}
                initialDate={
                    datePickerTarget === 'birthDate' ? birthDate :
                    datePickerTarget === 'inactivityStart' ? inactivityStartDate :
                    inactivityEndDate
                }
            />
        </SafeAreaView>
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
        padding: 20,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '90%',
        maxHeight: '85%',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#003399',
    },
    input: {
        width: '100%',
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    genderContainer: {
        flexDirection: 'row',
        marginBottom: 16,
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
        borderRadius: 14,
        padding: 12,
        elevation: 2,
        width: '100%',
        marginTop: 10,
        marginBottom: 8,
    },
    closeButton: {
        padding: 8,
    },
    textStyle: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center",
        fontSize: 16
    },
    closeButtonText: {
        color: "#666",
        textAlign: "center"
    },
    cardInactive: {
        opacity: 0.65,
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
    statusTabButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusTabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    inactivityBox: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginTop: 4,
    },
    datePickerField: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
    },
    presetChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
    },
    presetChipText: {
        fontSize: 12,
    },
});
