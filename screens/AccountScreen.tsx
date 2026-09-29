import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Image, Modal, FlatList, ActivityIndicator, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth, GlobalRole } from '../context/AuthContext';
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import ScreenTitle from '../components/ScreenTitle';
import { useTheme } from '../context/ThemeContext';
import { useEasterEggs } from '../context/EasterEggContext';
import { showAlert, showConfirmation } from '../utils/alert';
import SearchablePicker from '../components/SearchablePicker';
import {
    subscribeToMembers,
    Member,
    subscribeToMemberTournaments,
    MemberTournament,
    subscribeToStagioneCorrente,
    getCachedStagioneCorrente,
    calculateMemberStreaks,
    MemberStreaks
} from '../services/firestore';

export default function AccountScreen() {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const {
        userProfile,
        loading: authLoading,
        isGlobalAdmin,
        refreshUserProfile
    } = useAuth();
    const { findEgg } = useEasterEggs();
    const [versionTaps, setVersionTaps] = useState(0);

    // Helper to get display name for roles
    const getRoleDisplayName = (role: GlobalRole, isAdmin: boolean) => {
        if (isAdmin) return 'Observer';
        if (role === 'staff') return 'Game Advisor';
        return 'Bubba';
    };

    const myRole = getRoleDisplayName(userProfile?.role || null, isGlobalAdmin);

    // Admin Management State
    const [users, setUsers] = useState<any[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({
        observer: false,
        advisor: false,
        bubba: true // Default collapsed to save space? Or false. Let's say false.
    });

    // Profile Edit State
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [editFirstName, setEditFirstName] = useState("");
    const [editLastName, setEditLastName] = useState("");
    const [editNickname, setEditNickname] = useState("");

    // Member Linking State (Admin only now)
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [editMemberId, setEditMemberId] = useState<string>("");
    const [stagioneCorrente, setStagioneCorrente] = useState<string>(getCachedStagioneCorrente());
    const [myTournaments, setMyTournaments] = useState<MemberTournament[]>([]);
    const [myTournamentsCollapsed, setMyTournamentsCollapsed] = useState(false);
    const [pastTournamentsCollapsed, setPastTournamentsCollapsed] = useState(true);
    const [memberStreaks, setMemberStreaks] = useState<MemberStreaks | null>(null);

    // Password Change State
    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    useEffect(() => {
        const unsubscribeSeason = subscribeToStagioneCorrente((data) => {
            if (data?.stagioneCorrente) {
                setStagioneCorrente(data.stagioneCorrente);
            }
        });

        if (isGlobalAdmin) {
            fetchUsers();
        }

        const unsubscribeMembers = subscribeToMembers((data) => {
            setAllMembers(data);
        }, true);

        let unsubscribeTournaments = () => { };
        if (userProfile?.memberId) {
            unsubscribeTournaments = subscribeToMemberTournaments(
                userProfile.memberId,
                stagioneCorrente,
                (tournaments) => {
                    setMyTournaments(tournaments);
                }
            );

            // Fetch live streaks for the member
            calculateMemberStreaks(userProfile.memberId, stagioneCorrente)
                .then(streaks => setMemberStreaks(streaks))
                .catch(err => console.error("Error loading member streaks:", err));
        } else {
            setMyTournaments([]);
            setMemberStreaks(null);
        }

        return () => {
            unsubscribeSeason();
            unsubscribeMembers();
            unsubscribeTournaments();
        };
    }, [isGlobalAdmin, userProfile?.memberId, stagioneCorrente]);

    // Initialize edit fields when profile loads
    useEffect(() => {
        if (userProfile) {
            setEditFirstName(userProfile.firstName || "");
            setEditLastName(userProfile.lastName || "");
            setEditNickname(userProfile.nickname || "");
        }
    }, [userProfile]);

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const usersList = querySnapshot.docs.map(doc => {
                const data = doc.data();
                // Fallback logic for role: prioritize ruolo_globale
                let role = data.ruolo_globale;
                if (role === undefined) role = data.role;

                return {
                    uid: doc.id,
                    ...data,
                    role: role || null
                };
            });
            setUsers(usersList);
        } catch (error) {
            console.error("Error fetching users:", error);
            showAlert("Errore", "Impossibile caricare gli utenti.");
        } finally {
            setUsersLoading(false);
        }
    };



    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out: ", error);
            showAlert("Errore", "Impossibile effettuare il logout.");
        }
    };

    const openEditModal = (user: any) => {
        setSelectedUser(user);
        setEditMemberId(user.memberId || "");
        setEditModalVisible(true);
    };

    const handleSaveUserChanges = async (newRole?: GlobalRole) => {
        if (!selectedUser) return;
        const targetName = selectedUser.displayName || selectedUser.nickname || selectedUser.email || 'Utente';
        showConfirmation(
            "Conferma Modifica Utente",
            `Vuoi salvare le modifiche per "${targetName}"?`,
            async () => {
                try {
                    const userRef = doc(db, "users", selectedUser.uid);
                    const updateData: any = {
                        memberId: editMemberId || deleteField()
                    };

                    if (newRole !== undefined) {
                        updateData.role = newRole;
                        updateData.ruolo_globale = newRole;
                    }

                    await updateDoc(userRef, updateData);
                    setEditModalVisible(false);
                    fetchUsers(); // Refresh list
                    if (selectedUser.uid === auth.currentUser?.uid) {
                        refreshUserProfile();
                    }
                    showAlert("Successo", "Utente aggiornato correttamente.");
                } catch (error) {
                    console.error("Error updating user:", error);
                    showAlert("Errore", "Impossibile aggiornare l'utente.");
                }
            },
            "Salva Modifiche"
        );
    };

    const handleUpdateProfile = async () => {
        if (!auth.currentUser) return;
        showConfirmation(
            "Conferma Modifica Profilo",
            "Vuoi salvare i nuovi dati del tuo profilo personale?",
            async () => {
                try {
                    const userRef = doc(db, "users", auth.currentUser!.uid);
                    await updateDoc(userRef, {
                        firstName: editFirstName.trim(),
                        lastName: editLastName.trim(),
                        nickname: editNickname.trim(),
                        nome: `${editFirstName.trim()} ${editLastName.trim()}` // Legacy support
                    });
                    await refreshUserProfile();
                    setProfileModalVisible(false);
                    showAlert("Successo", "Profilo aggiornato.");
                } catch (error) {
                    console.error("Error updating profile:", error);
                    showAlert("Errore", "Impossibile aggiornare il profilo.");
                }
            },
            "Salva"
        );
    };

    const handleLinkMember = async () => {
        // Removed user-side linking
    };

    const handleChangePassword = async () => {
        if (!auth.currentUser || !currentPassword || !newPassword) {
            showAlert("Attenzione", "Inserisci la password attuale e la nuova password.");
            return;
        }

        try {
            // Re-authenticate user
            const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);

            // Update password
            await updatePassword(auth.currentUser, newPassword);
            setPasswordModalVisible(false);
            setCurrentPassword("");
            setNewPassword("");
            showAlert("Successo", "Password aggiornata.");
        } catch (error: any) {
            console.error("Error updating password:", error);
            if (error.code === 'auth/wrong-password') {
                showAlert("Errore", "La password attuale non è corretta.");
            } else {
                showAlert("Errore", "Impossibile aggiornare la password. Riprova.");
            }
        }
    };

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const renderUserSection = (title: string, data: any[], sectionKey: string) => {
        const isCollapsed = collapsedSections[sectionKey];
        return (
            <View style={{ marginBottom: 15 }}>
                <TouchableOpacity
                    style={[styles.sectionHeader, { backgroundColor: theme.colors.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: isCollapsed ? 0 : 10 }]}
                    onPress={() => toggleSection(sectionKey)}
                >
                    <Text style={[styles.sectionHeaderText, { color: theme.colors.primary, fontWeight: 'bold', fontSize: 16 }]}>{title} ({data.length})</Text>
                    <Image
                        source={require('../assets/arrow.png')}
                        style={{
                            width: 20,
                            height: 20,
                            tintColor: theme.colors.primary,
                            transform: [{ rotate: isCollapsed ? '90deg' : '-90deg' }]
                        }}
                    />
                </TouchableOpacity>

                {!isCollapsed && (
                    <View>
                        {data.map(item => (
                            <View key={item.uid} style={[styles.userItem, { backgroundColor: theme.colors.card, marginLeft: 10, borderLeftWidth: 3, borderLeftColor: theme.colors.primary }]}>
                                <View style={styles.userInfoContainer}>
                                    <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>{item.email}</Text>
                                    <Text style={[styles.userName, { color: theme.colors.text }]}>
                                        {item.firstName} {item.lastName} ({item.nickname || "No Nick"})
                                    </Text>
                                    {item.memberId && (
                                        <Text style={{ fontSize: 12, color: theme.colors.primary }}>
                                            🔗 {allMembers.find(m => m.id === item.memberId)?.firstName} {allMembers.find(m => m.id === item.memberId)?.lastName}
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => openEditModal(item)}>
                                    <Text style={[styles.editLink, { color: theme.colors.primary }]}>Modifica</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    const myMember = allMembers.find(m => m.id === userProfile?.memberId);
    const effectiveStreaks = memberStreaks || {
        currentStreak: myMember?.currentStreak || 0,
        streakMassima: myMember?.streakMassima || 0,
        streakCampo: myMember?.streakCampo || 0,
        streakPalestra: myMember?.streakPalestra || 0
    };

    const currentSeasonTournaments = myTournaments.filter(t => t.isCurrentSeason);
    const pastSeasonTournaments = myTournaments.filter(t => !t.isCurrentSeason);

    const formatTournamentDate = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    if (authLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScreenTitle title="IL TUO ACCOUNT" onBack={() => navigation.goBack()} containerStyle={{ marginTop: 20 }} />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* User Info Card */}
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.primary }]}>
                            <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                                {userProfile?.email?.charAt(0).toUpperCase() || "U"}
                            </Text>
                        </View>
                    </View>
                    <Text style={[styles.emailText, { color: theme.colors.textSecondary }]}>{userProfile?.email}</Text>
                    <Text style={[styles.nameText, { color: theme.colors.text }]}>
                        {userProfile?.firstName} {userProfile?.lastName}
                    </Text>
                    {userProfile?.nickname ? (
                        <Text style={[styles.nicknameText, { color: theme.colors.primary }]}>"{userProfile?.nickname}"</Text>
                    ) : null}

                    <View style={[styles.roleBadge, { backgroundColor: theme.colors.primary }]}>
                        <Text style={[styles.roleText, { color: '#fff' }]}>{myRole}</Text>
                    </View>

                    <View style={styles.actionButtonsContainer}>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.primary }]}
                            onPress={() => setProfileModalVisible(true)}
                        >
                            <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>Modifica Profilo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.passwordButton, { backgroundColor: theme.dark ? '#330000' : '#fff0f0' }]}
                            onPress={() => setPasswordModalVisible(true)}
                        >
                            <Text style={[styles.actionButtonText, { color: theme.colors.danger }]}>Cambia Password</Text>
                        </TouchableOpacity>
                    </View>

                </View>


                {/* My Tournaments Section */}
                {userProfile?.memberId && myTournaments.length > 0 && (
                    <View style={[styles.card, { backgroundColor: theme.colors.card, alignItems: 'stretch' }]}>
                        <TouchableOpacity
                            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: myTournamentsCollapsed ? 0 : 15 }}
                            onPress={() => setMyTournamentsCollapsed(!myTournamentsCollapsed)}
                        >
                            <Text style={[styles.sectionTitle, { color: theme.colors.primary, marginLeft: 0, marginBottom: 0 }]}>I Miei Tornei ({myTournaments.length})</Text>
                            <Image
                                source={require('../assets/arrow.png')}
                                style={{
                                    width: 20,
                                    height: 20,
                                    tintColor: theme.colors.primary,
                                    transform: [{ rotate: myTournamentsCollapsed ? '90deg' : '-90deg' }]
                                }}
                            />
                        </TouchableOpacity>

                        {!myTournamentsCollapsed && myTournaments.map(tournament => (
                            <View key={`${tournament.id}_${tournament.date}_${tournament.rosterId || ''}`} style={{ marginBottom: 15, width: '100%', borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 10 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.text }}>{tournament.title}</Text>
                                <Text style={{ color: theme.colors.textSecondary }}>
                                    {tournament.location ? `${tournament.location} - ` : ''}{formatTournamentDate(tournament.date)}{tournament.endDate ? ` - ${formatTournamentDate(tournament.endDate)}` : ''}
                                </Text>
                                {tournament.role && (
                                    <Text style={{ color: theme.colors.primary, fontWeight: '600', marginTop: 2 }}>
                                        {tournament.role === 'player' ? 'Giocatore' : 'Ospite'}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Admin Management Section */}
                {isGlobalAdmin && (
                    <View style={styles.managementSection}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Gestione Utenti ({users.length})</Text>

                        {usersLoading ? (
                            <ActivityIndicator color={theme.colors.primary} />
                        ) : (
                            <>
                                {renderUserSection('Observer (Admin)', users.filter(u => u.role === 'amministratore'), 'observer')}
                                {renderUserSection('Game Advisor (Staff)', users.filter(u => u.role === 'staff'), 'advisor')}
                                {renderUserSection('Bubba (User)', users.filter(u => u.role !== 'amministratore' && u.role !== 'staff'), 'bubba')}
                            </>
                        )}
                    </View>
                )}

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                {/* App Version Footer - Easter Egg */}
                <TouchableOpacity 
                    activeOpacity={1} 
                    style={{ marginTop: 30, alignItems: 'center', padding: 10 }}
                    onPress={() => {
                        const newCount = versionTaps + 1;
                        if (newCount === 7) {
                            findEgg('egg_account_ver', 'IL CALLAHAN!', 'Hai parato il disco e segnato un punto in difesa! Spettacolare!', 'callahan');
                            setVersionTaps(0);
                        } else {
                            setVersionTaps(newCount);
                            // Reset count after 3 seconds of inactivity
                            setTimeout(() => setVersionTaps(0), 3000);
                        }
                    }}
                >
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12, opacity: 0.5 }}>
                        Bubba App v1.2.0
                    </Text>
                </TouchableOpacity>
            </ScrollView>
            <Modal
                visible={editModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card, maxHeight: '80%' }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Gestione Utente</Text>
                        <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>{selectedUser?.email}</Text>

                        <Text style={{ alignSelf: 'flex-start', color: theme.colors.textSecondary, marginBottom: 5, fontWeight: 'bold' }}>Collega Profilo Giocatore:</Text>
                        <View style={{ width: '100%', marginBottom: 15, height: 60 }}>
                            <SearchablePicker
                                selectedValue={allMembers.find(m => m.id === editMemberId) ? `${allMembers.find(m => m.id === editMemberId)!.firstName} ${allMembers.find(m => m.id === editMemberId)!.lastName} (${allMembers.find(m => m.id === editMemberId)!.nickname || ''})` : ""}
                                items={allMembers.map(m => `${m.firstName} ${m.lastName} (${m.nickname || ''})`)}
                                onValueChange={(val) => {
                                    const member = allMembers.find(m => `${m.firstName} ${m.lastName} (${m.nickname || ''})` === val);
                                    if (member) setEditMemberId(member.id);
                                }}
                                placeholder="Nessun collegamento..."
                                title="Seleziona Giocatore"
                            />
                        </View>

                        {selectedUser?.uid !== auth.currentUser?.uid && (
                            <>
                                <Text style={{ alignSelf: 'flex-start', color: theme.colors.textSecondary, marginBottom: 5, fontWeight: 'bold' }}>Ruolo:</Text>
                                <TouchableOpacity
                                    style={[styles.roleOption, { backgroundColor: theme.colors.inputBackground }, (selectedUser?.role === 'Bubba' || selectedUser?.role === null) && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.primary, borderWidth: 1 }]}
                                    onPress={() => handleSaveUserChanges('Bubba')}
                                >
                                    <Text style={[styles.roleOptionText, { color: theme.colors.text }]}>Bubba (User)</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.roleOption, { backgroundColor: theme.colors.inputBackground }, selectedUser?.role === 'staff' && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.primary, borderWidth: 1 }]}
                                    onPress={() => handleSaveUserChanges('staff')}
                                >
                                    <Text style={[styles.roleOptionText, { color: theme.colors.text }]}>Game Advisor (Staff)</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.roleOption, { backgroundColor: theme.colors.inputBackground }, selectedUser?.role === 'amministratore' && { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.primary, borderWidth: 1 }]}
                                    onPress={() => handleSaveUserChanges('amministratore')}
                                >
                                    <Text style={[styles.roleOptionText, { color: theme.colors.text }]}>Observer (Admin)</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: theme.colors.primary, marginTop: 10 }]}
                            onPress={() => handleSaveUserChanges()}
                        >
                            <Text style={styles.saveButtonText}>Salva Modifiche</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setEditModalVisible(false)}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Profile Edit Modal */}
            <Modal
                visible={profileModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setProfileModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Modifica Profilo</Text>

                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Nome"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={editFirstName}
                            onChangeText={setEditFirstName}
                        />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Cognome"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={editLastName}
                            onChangeText={setEditLastName}
                        />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Soprannome"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={editNickname}
                            onChangeText={setEditNickname}
                        />

                        <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.colors.primary }]} onPress={handleUpdateProfile}>
                            <Text style={styles.saveButtonText}>Salva Modifiche</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setProfileModalVisible(false)}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Change Password Modal */}
            <Modal
                visible={passwordModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setPasswordModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Cambia Password</Text>

                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Password Attuale"
                            placeholderTextColor={theme.colors.textSecondary}
                            secureTextEntry
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                        />
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                            placeholder="Nuova Password"
                            placeholderTextColor={theme.colors.textSecondary}
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                        />

                        <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.colors.primary }]} onPress={handleChangePassword}>
                            <Text style={styles.saveButtonText}>Aggiorna Password</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setPasswordModalVisible(false)}
                        >
                            <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Annulla</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Link Member Modal Removed */}
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 20,
    },
    avatarContainer: {
        marginBottom: 15,
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#e3f2fd',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#003399',
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#003399',
    },
    emailText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 5,
    },
    nameText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 2,
    },
    nicknameText: {
        fontSize: 16,
        fontStyle: 'italic',
        color: '#003399',
        marginBottom: 10,
    },
    roleBadge: {
        backgroundColor: '#003399',
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 15,
        marginBottom: 15,
    },
    roleText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginTop: 10,
        flexWrap: 'wrap',
    },
    actionButton: {
        backgroundColor: '#e3f2fd',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#003399',
    },
    passwordButton: {
        backgroundColor: '#fff0f0',
        borderColor: '#ff4444',
    },
    actionButtonText: {
        color: '#003399',
        fontWeight: '600',
        fontSize: 14,
    },
    managementSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666',
        marginBottom: 10,
        marginLeft: 5,
    },
    userItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    userInfoContainer: {
        flex: 1,
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    userRole: {
        fontSize: 14,
        color: '#003399',
        marginTop: 2,
        fontWeight: '500',
    },
    editLink: {
        color: '#003399',
        fontWeight: 'bold',
        fontSize: 14,
        padding: 5,
    },
    logoutButton: {
        backgroundColor: '#ff4444',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    logoutText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
    },
    saveButton: {
        backgroundColor: '#003399',
        padding: 12,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
        marginTop: 5,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    roleOption: {
        width: '100%',
        padding: 15,
        borderRadius: 12,
        backgroundColor: '#f5f5f5',
        marginBottom: 10,
        alignItems: 'center',
    },
    roleOptionSelected: {
        backgroundColor: '#e3f2fd',
        borderWidth: 1,
        borderColor: '#003399',
    },
    roleOptionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    closeButton: {
        marginTop: 15,
        padding: 10,
    },
    closeButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    sectionHeader: {
        // Styles are inline for now or can be defined here
    },
    sectionHeaderText: {
        // Styles are inline for now or can be defined here
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    statBox: {
        flex: 1,
        borderRadius: 14,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statEmoji: {
        fontSize: 24,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    tournamentCard: {
        width: '100%',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    tournamentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    tournamentTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
    },
    roleTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginLeft: 8,
    },
    roleTagText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    tournamentDate: {
        fontSize: 13,
        marginTop: 2,
    }
});
