import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Switch, TextInput, Alert, ScrollView, SectionList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Event, Member, RosterMember, subscribeToRoster, addToRoster, removeFromRoster, updateRosterMember } from '../services/firestore';
import { useTheme } from '../context/ThemeContext';

type ParticipantsModalProps = {
    visible: boolean;
    onClose: () => void;
    event: Event | null;
    members: Member[];
    readOnly?: boolean;
    initialRoster?: RosterMember[];
    onAddMember?: (member: Member) => void;
    onAddGuest?: (name: string, gender?: 'M' | 'F') => void;
    onRemoveMember?: (id: string) => void;
    onToggleRole?: (item: RosterMember) => void;
    allEvents?: Event[];
    onOpenLinkedEvent?: (event: Event) => void;
    championships?: Event[];
    onAddMembers?: (members: Member[]) => void;
};

export default function ParticipantsModal({
    visible,
    onClose,
    event,
    members,
    readOnly = false,
    initialRoster,
    onAddMember,
    onAddGuest,
    onRemoveMember,
    onToggleRole,
    allEvents = [],
    onOpenLinkedEvent,
    championships = [],
    onAddMembers
}: ParticipantsModalProps) {
    const { theme } = useTheme();
    // State for the specific event's roster (who is actually coming/playing)
    const [eventRoster, setEventRoster] = useState<RosterMember[]>([]);
    // State for the global championship roster (available players for championship matches)
    const [globalRoster, setGlobalRoster] = useState<RosterMember[]>([]);

    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [newGuestName, setNewGuestName] = useState('');
    const [guestGender, setGuestGender] = useState<'M' | 'F'>('M');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLinkedEventsExpanded, setIsLinkedEventsExpanded] = useState(false);
    const [selectedMembersToAdd, setSelectedMembersToAdd] = useState<string[]>([]);

    // Mode detection
    const isGlobalRosterMode = event?.id === 'championship_roster_global';
    const isChampionshipSeason = event?.type === 'championship_season';

    // Find parent championship if this event is linked to one
    const parentChamp = !isGlobalRosterMode && !isChampionshipSeason && event
        ? championships.find(c => c.linkedEventIds?.includes(event.id))
        : null;

    // It is a championship match if it has a parent championship
    const isChampionshipMatch = !!parentChamp;

    const isTournament = !isGlobalRosterMode && !isChampionshipMatch && !isChampionshipSeason;

    // Effective Event ID for the list we are editing
    const currentEventId = isGlobalRosterMode ? 'championship' : event?.id;

    useEffect(() => {
        if (visible) {
            if (initialRoster) {
                setEventRoster(initialRoster);
                return;
            }

            // 1. Always subscribe to the current event's roster (unless it's null)
            let unsubscribeEventRoster: () => void = () => { };
            if (currentEventId) {
                unsubscribeEventRoster = subscribeToRoster(currentEventId, (updated) => {
                    setEventRoster(updated);
                });
            }

            // 2. If it's a Championship Match, ALSO subscribe to the Parent Championship Roster
            let unsubscribeGlobalRoster: () => void = () => { };
            if (isChampionshipMatch && parentChamp) {
                unsubscribeGlobalRoster = subscribeToRoster(parentChamp.id, (updated) => {
                    setGlobalRoster(updated);
                });
            } else if (isGlobalRosterMode) {
                // Special case for the "Global Roster" button in RosterScreen
                unsubscribeGlobalRoster = subscribeToRoster('championship', (updated) => {
                    setGlobalRoster(updated);
                });
            }

            return () => {
                unsubscribeEventRoster();
                unsubscribeGlobalRoster();
            };
        } else {
            setEventRoster([]);
            setGlobalRoster([]);
        }
    }, [visible, currentEventId, isChampionshipMatch, initialRoster, parentChamp]);


    // --- Actions ---

    const handleAddMember = (member: Member) => {
        // Always toggle selection for multi-select
        if (selectedMembersToAdd.includes(member.id)) {
            setSelectedMembersToAdd(selectedMembersToAdd.filter(id => id !== member.id));
        } else {
            setSelectedMembersToAdd([...selectedMembersToAdd, member.id]);
        }
    };

    const handleConfirmAddMembers = () => {
        if (selectedMembersToAdd.length > 0) {
            const membersToAdd = members.filter(m => selectedMembersToAdd.includes(m.id));

            if (onAddMembers) {
                onAddMembers(membersToAdd);
            } else if (onAddMember) {
                // Fallback for single add callback if multi not supported (shouldn't happen with new design but safe to keep)
                membersToAdd.forEach(m => onAddMember(m));
            } else if (currentEventId) {
                // Default Firestore add
                membersToAdd.forEach(member => {
                    const name = `${member.firstName} ${member.lastName || ''}`.trim();
                    addToRoster(currentEventId, name, false, member.id, 'player');
                });
            }

            setSelectedMembersToAdd([]);
            setShowAddMemberModal(false);
        }
    };

    const handleAddGuest = () => {
        if (newGuestName.trim()) {
            if (onAddGuest) {
                onAddGuest(newGuestName.trim(), guestGender);
                setNewGuestName('');
                setGuestGender('M'); // Reset
                setShowAddMemberModal(false);
                return;
            }
            if (currentEventId) {
                // Note: addToRoster doesn't currently support gender, but we might need it later.
                // For now, we only use gender for MatchDetailScreen which uses onAddGuest.
                addToRoster(currentEventId, newGuestName.trim(), true, undefined, 'player');
                setNewGuestName('');
                setGuestGender('M'); // Reset
                setShowAddMemberModal(false);
            }
        }
    };

    const handleRemove = (id: string) => {
        if (onRemoveMember) {
            onRemoveMember(id);
        } else {
            removeFromRoster(id);
        }
    };

    const handleToggleRole = (item: RosterMember) => {
        if (onToggleRole) {
            onToggleRole(item);
        } else {
            const newRole = item.role === 'guest' ? 'player' : 'guest';
            updateRosterMember(item.id, { role: newRole });
        }
    };

    // --- Championship Match Specific Logic ---
    // Toggle presence means adding/removing from the EVENT roster based on the GLOBAL roster member
    const toggleChampionshipPresence = (globalMember: RosterMember) => {
        const existingEntry = eventRoster.find(r => r.memberId === globalMember.memberId || (r.name === globalMember.name && r.isGuest === globalMember.isGuest));

        if (existingEntry) {
            // Remove from event roster (Mark Absent)
            removeFromRoster(existingEntry.id);
        } else {
            // Add to event roster (Mark Present)
            if (currentEventId) {
                addToRoster(currentEventId, globalMember.name, globalMember.isGuest, globalMember.memberId, 'player');
            }
        }
    };

    // --- Data Preparation for Views ---

    const getSections = () => {
        if (isChampionshipMatch) {
            // Group by Present / Absent based on Global Roster
            const presentIds = new Set(eventRoster.map(r => r.memberId || r.name)); // Use ID or Name for matching

            const present = globalRoster.filter(m => eventRoster.some(r =>
                (r.memberId && r.memberId === m.memberId) || (!r.memberId && r.name === m.name)
            ));

            const absent = globalRoster.filter(m => !eventRoster.some(r =>
                (r.memberId && r.memberId === m.memberId) || (!r.memberId && r.name === m.name)
            ));

            return [
                { title: `Presenti (${present.length})`, data: present, type: 'present' },
                { title: `Assenti (${absent.length})`, data: absent, type: 'absent' }
            ];
        } else if (isTournament) {
            // Group by Role: Players / Guests
            const players = eventRoster.filter(r => r.role !== 'guest');
            const guests = eventRoster.filter(r => r.role === 'guest');

            return [
                { title: `Giocatori (${players.length})`, data: players, type: 'player' },
                { title: `Guest (${guests.length})`, data: guests, type: 'guest' }
            ];
        } else if (isChampionshipSeason) {
            // Championship Season: Show Linked Events AND Roster
            const linkedIds = event?.linkedEventIds || [];
            const linkedEvents = allEvents.filter(e => linkedIds.includes(e.id));

            const linkedItems = linkedEvents.map(e => ({
                id: e.id,
                name: `${e.title} (${e.date})`,
                isGuest: false,
                role: 'player' // dummy
            } as RosterMember));

            return [
                {
                    title: `Partite Collegate (${linkedItems.length})`,
                    data: isLinkedEventsExpanded ? linkedItems : [],
                    type: 'linked_events',
                    count: linkedItems.length // Pass count for header
                },
                {
                    title: `Rosa Campionato (${eventRoster.length})`,
                    data: eventRoster,
                    type: 'championship_roster'
                }
            ];
        } else {
            // Global Roster Mode: Single list
            return [{ title: `Rosa Totale (${eventRoster.length})`, data: eventRoster, type: 'all' }];
        }
    };

    const sections = getSections();

    // --- Renderers ---

    const renderSectionHeader = ({ section: { title, type, count } }: any) => {
        if (type === 'linked_events') {
            return (
                <TouchableOpacity
                    style={[styles.sectionHeader, { backgroundColor: theme.colors.primary + '20', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => setIsLinkedEventsExpanded(!isLinkedEventsExpanded)}
                >
                    <Text style={[styles.sectionHeaderText, { color: theme.colors.text }]}>{title}</Text>
                    <Image
                        source={require('../assets/arrow.png')}
                        style={{
                            width: 20,
                            height: 20,
                            tintColor: theme.colors.text,
                            transform: [{ rotate: isLinkedEventsExpanded ? '-90deg' : '90deg' }]
                        }}
                    />
                </TouchableOpacity>
            );
        }
        return (
            <View style={[styles.sectionHeader,
            type === 'present' ? { backgroundColor: theme.colors.success + '20' } :
                type === 'absent' ? { backgroundColor: theme.colors.danger + '20' } :
                    { backgroundColor: theme.colors.primary + '20' }
            ]}>
                <Text style={[styles.sectionHeaderText, { color: theme.colors.text }]}>{title}</Text>
            </View>
        );
    };

    const renderItem = ({ item, section }: { item: RosterMember, section: any }) => {
        if (isChampionshipMatch) {
            // Championship Match Item (Toggle Presence)
            const isPresent = section.type === 'present';
            return (
                <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
                    <Text style={[styles.nameText, { color: theme.colors.text }, !isPresent && { color: theme.colors.textSecondary }]}>
                        {item.name} {item.isGuest ? '(Ospite)' : ''}
                    </Text>
                    <Switch
                        value={isPresent}
                        onValueChange={() => toggleChampionshipPresence(item)}
                        trackColor={{ false: "#767577", true: theme.colors.primary }}
                        thumbColor={isPresent ? "#fff" : "#f4f3f4"}
                        disabled={readOnly}
                    />
                </View>
            );
        } else if (section.type === 'linked_events') {
            // Linked Event Item
            // Find the original event object to pass back
            const originalEvent = allEvents.find(e => e.id === item.id);

            return (
                <TouchableOpacity
                    style={[styles.row, { borderBottomColor: theme.colors.border }]}
                    onPress={() => originalEvent && onOpenLinkedEvent && onOpenLinkedEvent(originalEvent)}
                    disabled={!onOpenLinkedEvent || !originalEvent}
                >
                    <Text style={[styles.nameText, { color: theme.colors.text }]}>
                        {item.name} {originalEvent ? '' : '(Evento non trovato)'}
                    </Text>
                    {originalEvent && (
                        <Image
                            source={require('../assets/arrow.png')}
                            style={{
                                width: 20,
                                height: 20,
                                tintColor: theme.colors.textSecondary
                            }}
                        />
                    )}
                </TouchableOpacity>
            );
        } else {
            // Standard Item (Remove / Toggle Role)
            return (
                <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => !readOnly && isTournament && handleToggleRole(item)}
                        activeOpacity={readOnly ? 1 : 0.7}
                    >
                        <Text style={[styles.nameText, { color: theme.colors.text }]}>{item.name} {item.isGuest ? '(Esterno)' : ''} {item.gender ? `(${item.gender})` : ''}</Text>
                        {isTournament && (
                            <Text style={{ color: item.role === 'guest' ? theme.colors.textSecondary : theme.colors.primary, fontSize: 12, fontWeight: 'bold', marginTop: 2 }}>
                                {item.role === 'guest' ? 'GUEST (Non gioca)' : 'GIOCATORE'}
                            </Text>
                        )}
                    </TouchableOpacity>
                    {!readOnly && (
                        <TouchableOpacity onPress={() => handleRemove(item.id)} style={{ paddingLeft: 10 }}>
                            <Image source={require('../assets/x.png')} style={{ width: 24, height: 24 }} />
                        </TouchableOpacity>
                    )}
                </View>
            );
        }
    };

    // Filter for Add Member Modal
    const filteredMembers = members.filter(m => {
        const matchesSearch = `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.nickname && m.nickname.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        return !eventRoster.some(r => r.memberId === m.id);
    });

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                    <Text style={[styles.title, { color: theme.colors.primary }]}>
                        {isGlobalRosterMode ? 'Gestione Rosa' :
                            isChampionshipMatch ? 'Convocazioni' :
                                isChampionshipSeason ? 'Dettagli Campionato' : 'Partecipanti'}
                    </Text>
                    <TouchableOpacity onPress={onClose} style={{ padding: 5 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Image source={require('../assets/x.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />
                    </TouchableOpacity>
                </View>

                {/* Toolbar / Add Button */}
                {!isChampionshipMatch && !readOnly && (
                    <TouchableOpacity
                        style={[styles.addParticipantButton, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.primary }]}
                        onPress={() => setShowAddMemberModal(true)}
                    >
                        <Text style={[styles.addParticipantText, { color: theme.colors.primary }]}>+ Aggiungi Partecipante</Text>
                    </TouchableOpacity>
                )}

                {isChampionshipMatch && (
                    <View style={[styles.infoBox, { backgroundColor: theme.colors.warning + '20' }]}>
                        <Text style={[styles.infoText, { color: theme.colors.warning }]}>Gestisci le presenze basate sulla Rosa Campionato.</Text>
                    </View>
                )}

                <SectionList
                    sections={sections}
                    keyExtractor={(item, index) => item.id + index}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    contentContainerStyle={styles.list}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Nessun partecipante.</Text>}
                />

                {/* Add Member/Guest Modal */}
                <Modal visible={showAddMemberModal} animationType="fade" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Aggiungi Persona</Text>

                            <TextInput
                                style={[styles.searchInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                placeholder="Cerca membro..."
                                placeholderTextColor={theme.colors.textSecondary}
                                value={searchTerm}
                                onChangeText={setSearchTerm}
                            />

                            <ScrollView style={styles.memberList}>
                                {filteredMembers.map(member => {
                                    const isSelected = selectedMembersToAdd.includes(member.id);
                                    return (
                                        <TouchableOpacity
                                            key={member.id}
                                            style={[
                                                styles.memberItem,
                                                { borderBottomColor: theme.colors.border },
                                                isSelected && { backgroundColor: theme.colors.primary + '20' }
                                            ]}
                                            onPress={() => handleAddMember(member)}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={{ color: theme.colors.text }}>{member.firstName} {member.lastName} ({member.nickname})</Text>
                                                {isSelected && <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {selectedMembersToAdd.length > 0 && (
                                <TouchableOpacity
                                    style={[styles.guestButton, { backgroundColor: theme.colors.primary, marginVertical: 10 }]}
                                    onPress={handleConfirmAddMembers}
                                >
                                    <Text style={styles.guestButtonText}>Aggiungi Selezionati ({selectedMembersToAdd.length})</Text>
                                </TouchableOpacity>
                            )}

                            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                            <Text style={[styles.subTitle, { color: theme.colors.text }]}>Oppure aggiungi esterno:</Text>
                            <View style={styles.guestRow}>
                                <TextInput
                                    style={[styles.guestInput, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                                    placeholder="Nome ospite"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={newGuestName}
                                    onChangeText={setNewGuestName}
                                />
                                <View style={{ flexDirection: 'row', gap: 5 }}>
                                    <TouchableOpacity
                                        style={[styles.genderButton, guestGender === 'M' && { backgroundColor: '#e3f2fd', borderColor: '#003399' }]}
                                        onPress={() => setGuestGender('M')}
                                    >
                                        <Text style={{ color: guestGender === 'M' ? '#003399' : theme.colors.textSecondary }}>M</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.genderButton, guestGender === 'F' && { backgroundColor: '#fce4ec', borderColor: '#c2185b' }]}
                                        onPress={() => setGuestGender('F')}
                                    >
                                        <Text style={{ color: guestGender === 'F' ? '#c2185b' : theme.colors.textSecondary }}>F</Text>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    style={[styles.guestButton, { backgroundColor: theme.colors.primary }]}
                                    onPress={handleAddGuest}
                                >
                                    <Text style={styles.guestButtonText}>OK</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.closeModalButton}
                                onPress={() => setShowAddMemberModal(false)}
                            >
                                <Text style={[styles.closeModalText, { color: theme.colors.textSecondary }]}>Chiudi</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#003399' },
    list: { padding: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    nameText: { fontSize: 16, color: '#333' },
    textGray: { color: '#999' },
    emptyText: { textAlign: 'center', color: '#999', marginTop: 20 },

    // Sections
    sectionHeader: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 15, marginBottom: 5 },
    headerGreen: { backgroundColor: '#e8f5e9' },
    headerRed: { backgroundColor: '#ffebee' },
    headerBlue: { backgroundColor: '#e3f2fd' },
    sectionHeaderText: { fontSize: 16, fontWeight: 'bold', color: '#333' },

    // Buttons
    addParticipantButton: { margin: 20, padding: 15, backgroundColor: '#e3f2fd', borderRadius: 10, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#003399' },
    addParticipantText: { color: '#003399', fontSize: 16, fontWeight: 'bold' },
    infoBox: { margin: 20, padding: 10, backgroundColor: '#fff3e0', borderRadius: 8 },
    infoText: { color: '#e65100', textAlign: 'center' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', height: '80%', backgroundColor: '#fff', borderRadius: 15, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    searchInput: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, marginBottom: 10 },
    memberList: { flex: 1 },
    memberItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    divider: { height: 1, backgroundColor: '#ddd', marginVertical: 15 },
    subTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
    guestRow: { flexDirection: 'row', gap: 10 },
    guestInput: { flex: 1, backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8 },
    guestButton: { backgroundColor: '#003399', padding: 10, borderRadius: 8, justifyContent: 'center' },
    guestButtonText: { color: '#fff', fontWeight: 'bold' },
    genderButton: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', minWidth: 40 },
    closeModalButton: { marginTop: 20, padding: 10, alignItems: 'center' },
    closeModalText: { color: '#666' }
});
