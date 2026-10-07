import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    ScrollView,
    TouchableOpacity,
    TextInput
} from 'react-native';
import { Event, Member, MatchRosterPlayer } from '../../services/firestore';
import { getEventDays, formatTournamentDay, formatDate } from './analisiPartitaUtils';
import { analisiPartitaStyles as styles } from './analisiPartitaStyles';
import { useTheme } from '../../context/ThemeContext';
import { showAlert } from '../../utils/alert';

interface CreateEditMatchModalProps {
    visible: boolean;
    onClose: () => void;
    editingMatchId: string | null;
    opponent: string;
    setOpponent: (v: string) => void;
    date: string;
    setDate: (v: string) => void;
    surface: 'sabbia' | 'erba';
    setSurface: (v: 'sabbia' | 'erba') => void;
    pullFirst: 'us' | 'them';
    setPullFirst: (v: 'us' | 'them') => void;
    firstRatio: 'M' | 'F';
    setFirstRatio: (v: 'M' | 'F') => void;
    dir0: 'R' | 'L';
    setDir0: (v: 'R' | 'L') => void;
    isSingleMatch: boolean;
    setIsSingleMatch: (v: boolean) => void;
    selectedEventId: string;
    onSelectEvent: (evId: string) => void;
    selectedEvent: Event | null;
    tournamentEvents: Event[];
    selectedRoster: MatchRosterPlayer[];
    setSelectedRoster: React.Dispatch<React.SetStateAction<MatchRosterPlayer[]>>;
    rosterSourceEvent: string | null;
    allMembers: Member[];
    onOpenDatePicker: () => void;
    onSaveMatch: () => void;
    idRemappings: Record<string, string>;
    setIdRemappings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export const CreateEditMatchModal: React.FC<CreateEditMatchModalProps> = ({
    visible,
    onClose,
    editingMatchId,
    opponent,
    setOpponent,
    date,
    setDate,
    surface,
    setSurface,
    pullFirst,
    setPullFirst,
    firstRatio,
    setFirstRatio,
    dir0,
    setDir0,
    isSingleMatch,
    setIsSingleMatch,
    selectedEventId,
    onSelectEvent,
    selectedEvent,
    tournamentEvents,
    selectedRoster,
    setSelectedRoster,
    rosterSourceEvent,
    allMembers,
    onOpenDatePicker,
    onSaveMatch,
    setIdRemappings
}) => {
    const { theme } = useTheme();

    const [rosterExpanded, setRosterExpanded] = useState(false);
    const [remappingPlayer, setRemappingPlayer] = useState<MatchRosterPlayer | null>(null);
    const [remappingSearch, setRemappingSearch] = useState('');
    const [newGuestName, setNewGuestName] = useState('');
    const [newGuestGender, setNewGuestGender] = useState<'M' | 'F'>('F');

    if (!visible) return null;

    const filteredMembersToRemap = remappingSearch.trim()
        ? allMembers.filter(m => {
            const q = remappingSearch.toLowerCase();
            return (
                (m.nickname && m.nickname.toLowerCase().includes(q)) ||
                (m.firstName && m.firstName.toLowerCase().includes(q)) ||
                (m.lastName && m.lastName.toLowerCase().includes(q))
            );
        })
        : allMembers;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                    <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            {editingMatchId ? 'Modifica Partita' : 'Nuova Partita'}
                        </Text>

                        {/* Squadra Avversaria */}
                        <Text style={[styles.label, { color: theme.colors.text }]}>Squadra Avversaria *</Text>
                        <TextInput
                            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={opponent}
                            onChangeText={setOpponent}
                            placeholder="Es: Cus Padova, Rimini..."
                            placeholderTextColor={theme.colors.textSecondary}
                        />

                        {/* Data */}
                        <Text style={[styles.label, { color: theme.colors.text }]}>Data Partita</Text>
                        <TouchableOpacity
                            style={[styles.dateButton, { borderColor: theme.colors.border }]}
                            onPress={onOpenDatePicker}
                        >
                            <Text style={{ color: theme.colors.text }}>{formatDate(date)}</Text>
                        </TouchableOpacity>

                        {/* Tipologia: Partita Singola vs Torneo/Campionato */}
                        <Text style={[styles.label, { color: theme.colors.text }]}>Tipologia Partita</Text>
                        <View style={styles.segmentContainer}>
                            <TouchableOpacity
                                style={[styles.segmentBtn, isSingleMatch && styles.segmentBtnActive]}
                                onPress={() => setIsSingleMatch(true)}
                            >
                                <Text style={[styles.segmentText, isSingleMatch && styles.segmentTextActive]}>
                                    Partita Singola
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentBtn, !isSingleMatch && styles.segmentBtnActive]}
                                onPress={() => setIsSingleMatch(false)}
                            >
                                <Text style={[styles.segmentText, !isSingleMatch && styles.segmentTextActive]}>
                                    Torneo / Campionato
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Seleziona Torneo o Campionato */}
                        {!isSingleMatch && (
                            <View style={{ marginTop: 10 }}>
                                <Text style={[styles.label, { color: theme.colors.text }]}>Seleziona Torneo o Campionato</Text>
                                {tournamentEvents.length === 0 ? (
                                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginVertical: 6 }}>
                                        Nessun torneo o campionato presente a calendario.
                                    </Text>
                                ) : (
                                    <ScrollView
                                        style={[styles.tournamentScrollBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                                        nestedScrollEnabled={true}
                                        showsVerticalScrollIndicator={true}
                                    >
                                        {tournamentEvents.map((ev: Event) => {
                                            const isSelected = selectedEventId === ev.id;
                                            const icon = ev.type === 'tournament' ? '🏆' : '🏅';
                                            return (
                                                <TouchableOpacity
                                                    key={ev.id}
                                                    style={[
                                                        styles.tournamentSelectItem,
                                                        isSelected && { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary }
                                                    ]}
                                                    onPress={() => onSelectEvent(ev.id)}
                                                >
                                                    <Text style={{ fontSize: 16 }}>{icon}</Text>
                                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                                        <Text style={[styles.tournamentSelectTitle, { color: isSelected ? theme.colors.primary : theme.colors.text }]}>
                                                            {ev.title}
                                                        </Text>
                                                        <Text style={[styles.tournamentSelectDate, { color: theme.colors.textSecondary }]}>
                                                            Data: {formatDate(ev.date)}
                                                        </Text>
                                                    </View>
                                                    {isSelected && (
                                                        <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 16 }}>✓</Text>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                )}

                                {selectedEvent && (() => {
                                    const days = getEventDays(selectedEvent);
                                    if (!days.length) return null;
                                    const isMultiDay = days.length > 1;
                                    return (
                                        <View style={{ marginTop: 10, padding: 12, borderRadius: 8, backgroundColor: '#F0F7FF', borderWidth: 1, borderColor: '#BAE6FD' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#003057' }}>
                                                    📅 Data Partita dal Torneo
                                                </Text>
                                                <Text style={{ fontSize: 11, color: '#555' }}>
                                                    {formatDate(selectedEvent.date)}{selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.date ? ` – ${formatDate(selectedEvent.endDate)}` : ''}
                                                </Text>
                                            </View>
                                            <Text style={{ fontSize: 12, color: theme.colors.text, marginBottom: 8 }}>
                                                {isMultiDay
                                                    ? 'In quale giorno del torneo si gioca la partita?'
                                                    : 'Data del torneo impostata automaticamente:'}
                                            </Text>
                                            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                                {days.map((dayStr, idx) => {
                                                    const isDaySelected = date === dayStr;
                                                    return (
                                                        <TouchableOpacity
                                                            key={dayStr}
                                                            style={{
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 7,
                                                                borderRadius: 8,
                                                                borderWidth: 2,
                                                                borderColor: isDaySelected ? '#003057' : '#CBD5E1',
                                                                backgroundColor: isDaySelected ? '#003057' : '#fff',
                                                                alignItems: 'center',
                                                                minWidth: 95
                                                            }}
                                                            onPress={() => setDate(dayStr)}
                                                        >
                                                            <Text style={{ fontSize: 10, fontWeight: '700', color: isDaySelected ? '#C0D725' : '#64748B' }}>
                                                                Giorno {idx + 1}
                                                            </Text>
                                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDaySelected ? '#fff' : '#1E293B', textTransform: 'capitalize' }}>
                                                                {formatTournamentDay(dayStr)}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                            {!days.includes(date) && (
                                                <View style={{ marginTop: 8, backgroundColor: '#FFFBEB', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                                                    <Text style={{ fontSize: 11, color: '#B45309', fontWeight: '600' }}>
                                                        ⚠️ La data attuale ({formatDate(date)}) non coincide con le date del torneo. Tocca uno dei giorni sopra per allinearla.
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })()}

                                {rosterSourceEvent && (
                                    <View style={{ backgroundColor: '#e8f5e9', padding: 8, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#a5d6a7' }}>
                                        <Text style={{ fontSize: 12, color: '#2e7d32', fontWeight: 'bold' }}>
                                            ✓ Roster caricato da "{rosterSourceEvent}" ({selectedRoster.length} convocati)
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Chi batte per primo (Pull First) */}
                        <Text style={[styles.label, { color: theme.colors.text }]}>Chi effettua il primo Pull?</Text>
                        <View style={styles.segmentContainer}>
                            <TouchableOpacity
                                style={[styles.segmentBtn, pullFirst === 'us' && styles.segmentBtnActive]}
                                onPress={() => setPullFirst('us')}
                            >
                                <Text style={[styles.segmentText, pullFirst === 'us' && styles.segmentTextActive]}>
                                    Noi (Difesa)
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentBtn, pullFirst === 'them' && styles.segmentBtnActive]}
                                onPress={() => setPullFirst('them')}
                            >
                                <Text style={[styles.segmentText, pullFirst === 'them' && styles.segmentTextActive]}>
                                    Loro (Attacco)
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Regola ABBA: Primo Rapporto di Genere */}
                        <Text style={[styles.label, { color: theme.colors.text }]}>Rapporto Punto 1 (Regola ABBA)</Text>
                        <View style={styles.segmentContainer}>
                            <TouchableOpacity
                                style={[styles.segmentBtn, firstRatio === 'F' && { backgroundColor: '#B8338A', borderColor: '#B8338A' }]}
                                onPress={() => setFirstRatio('F')}
                            >
                                <Text style={[styles.segmentText, firstRatio === 'F' && styles.segmentTextActive]}>
                                    3 Donne / 2 Uomini
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentBtn, firstRatio === 'M' && { backgroundColor: '#1F6FD1', borderColor: '#1F6FD1' }]}
                                onPress={() => setFirstRatio('M')}
                            >
                                <Text style={[styles.segmentText, firstRatio === 'M' && styles.segmentTextActive]}>
                                    3 Uomini / 2 Donne
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Direzione iniziale campo */}
                        <Text style={[styles.label, { color: theme.colors.text }]}>Direzione nostro attacco (Punto 1)</Text>
                        <View style={styles.segmentContainer}>
                            <TouchableOpacity
                                style={[styles.segmentBtn, dir0 === 'R' && styles.segmentBtnActive]}
                                onPress={() => setDir0('R')}
                            >
                                <Text style={[styles.segmentText, dir0 === 'R' && styles.segmentTextActive]}>
                                    Verso Destra ▶
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentBtn, dir0 === 'L' && styles.segmentBtnActive]}
                                onPress={() => setDir0('L')}
                            >
                                <Text style={[styles.segmentText, dir0 === 'L' && styles.segmentTextActive]}>
                                    ◀ Verso Sinistra
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Superficie */}
                        <Text style={[styles.label, { color: theme.colors.text }]}>Superficie</Text>
                        <View style={styles.segmentContainer}>
                            <TouchableOpacity
                                style={[styles.segmentBtn, surface === 'sabbia' && styles.segmentBtnActive]}
                                onPress={() => setSurface('sabbia')}
                            >
                                <Text style={[styles.segmentText, surface === 'sabbia' && styles.segmentTextActive]}>
                                    🏖️ Sabbia (13 pt)
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segmentBtn, surface === 'erba' && styles.segmentBtnActive]}
                                onPress={() => setSurface('erba')}
                            >
                                <Text style={[styles.segmentText, surface === 'erba' && styles.segmentTextActive]}>
                                    🌱 Erba (15 pt)
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Sezione Convocati Partita */}
                        <View style={{ marginTop: 14 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={[styles.label, { color: theme.colors.text, marginTop: 0 }]}>
                                    Convocati ({selectedRoster.length})
                                </Text>
                                <TouchableOpacity onPress={() => setRosterExpanded(!rosterExpanded)}>
                                    <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: 'bold' }}>
                                        {rosterExpanded ? 'Nascondi ▲' : 'Modifica / Visualizza ▼'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
                                {selectedRoster.filter(p => p.g === 'F').length} Donne · {selectedRoster.filter(p => p.g === 'M').length} Uomini
                                {rosterSourceEvent ? ` (Caricati da: ${rosterSourceEvent})` : ''}
                            </Text>

                            {rosterExpanded && (
                                <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 10, marginTop: 8, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                                    {remappingPlayer ? (
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text }}>
                                                    🔗 Collega "{remappingPlayer.name}"
                                                </Text>
                                                <TouchableOpacity onPress={() => setRemappingPlayer(null)}>
                                                    <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: 'bold' }}>Annulla</Text>
                                                </TouchableOpacity>
                                            </View>

                                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>
                                                Seleziona il membro a cui assegnare i dati e gli eventi di questo giocatore:
                                            </Text>

                                            <TextInput
                                                style={{
                                                    borderWidth: 1,
                                                    borderColor: theme.colors.border,
                                                    borderRadius: 6,
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 5,
                                                    fontSize: 12,
                                                    color: theme.colors.text,
                                                    marginBottom: 6
                                                }}
                                                placeholder="Cerca membro..."
                                                placeholderTextColor={theme.colors.textSecondary}
                                                value={remappingSearch}
                                                onChangeText={setRemappingSearch}
                                            />

                                            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                                                <View style={{ gap: 4 }}>
                                                    {filteredMembersToRemap.map(m => {
                                                        const mGender: 'M' | 'F' = m.gender === 'F' ? 'F' : 'M';
                                                        return (
                                                            <TouchableOpacity
                                                                key={m.id}
                                                                style={{
                                                                    flexDirection: 'row',
                                                                    alignItems: 'center',
                                                                    paddingVertical: 6,
                                                                    paddingHorizontal: 8,
                                                                    borderRadius: 6,
                                                                    backgroundColor: theme.colors.card,
                                                                    borderWidth: 1,
                                                                    borderColor: theme.colors.border
                                                                }}
                                                                onPress={() => {
                                                                    const targetName = m.nickname || m.firstName;
                                                                    const targetGender = m.gender === 'F' ? ('F' as const) : ('M' as const);

                                                                    setSelectedRoster(prev => {
                                                                        if (prev.some(p => p.id === m.id)) {
                                                                            return prev.filter(p => p.id !== remappingPlayer.id);
                                                                        }
                                                                        return prev.map(p =>
                                                                            p.id === remappingPlayer.id
                                                                                ? { id: m.id, name: targetName, g: targetGender }
                                                                                : p
                                                                        );
                                                                    });

                                                                    setIdRemappings(prev => ({
                                                                        ...prev,
                                                                        [remappingPlayer.id]: m.id
                                                                    }));

                                                                    setRemappingPlayer(null);
                                                                    setRemappingSearch('');
                                                                    showAlert(
                                                                        "Giocatore Assegnato",
                                                                        `"${remappingPlayer.name}" assegnato a "${targetName}". Ricorda di cliccare su Salva per salvare le modifiche.`
                                                                    );
                                                                }}
                                                            >
                                                                <Text style={{ width: 20, fontSize: 12, fontWeight: 'bold', color: mGender === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                                                    {mGender}
                                                                </Text>
                                                                <Text style={{ flex: 1, fontSize: 13, color: theme.colors.text }}>
                                                                    {m.nickname || m.firstName} {m.lastName || ''}
                                                                </Text>
                                                                <View style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 }}>
                                                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Collega</Text>
                                                                </View>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </ScrollView>
                                        </View>
                                    ) : (
                                        <View>
                                            {selectedRoster.length > 0 && (
                                                <View style={{ marginBottom: 10 }}>
                                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 }}>
                                                        Giocatori Convocati ({selectedRoster.length}):
                                                    </Text>
                                                    <ScrollView style={{ maxHeight: 130 }} nestedScrollEnabled>
                                                        <View style={{ gap: 4 }}>
                                                            {selectedRoster.map(p => {
                                                                const isGuestOrImported = p.id.startsWith('guest_') || p.id.startsWith('imported_') || (p as any).isGuest;
                                                                return (
                                                                    <View
                                                                        key={p.id}
                                                                        style={{
                                                                            flexDirection: 'row',
                                                                            alignItems: 'center',
                                                                            paddingVertical: 4,
                                                                            paddingHorizontal: 8,
                                                                            borderRadius: 6,
                                                                            backgroundColor: theme.colors.card,
                                                                            borderWidth: 1,
                                                                            borderColor: theme.colors.border
                                                                        }}
                                                                    >
                                                                        <TouchableOpacity
                                                                            disabled={!isGuestOrImported}
                                                                            onPress={() => {
                                                                                if (!isGuestOrImported) return;
                                                                                const nextG: 'M' | 'F' = p.g === 'F' ? 'M' : 'F';
                                                                                setSelectedRoster(prev => prev.map(x => x.id === p.id ? { ...x, g: nextG } : x));
                                                                            }}
                                                                            style={{
                                                                                paddingHorizontal: 4,
                                                                                paddingVertical: 1,
                                                                                borderRadius: 4,
                                                                                backgroundColor: isGuestOrImported ? (p.g === 'F' ? '#FCE4EC' : '#E3F2FD') : 'transparent',
                                                                                marginRight: 4
                                                                            }}
                                                                        >
                                                                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: p.g === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                                                                {p.g}{isGuestOrImported ? ' ⇄' : ''}
                                                                            </Text>
                                                                        </TouchableOpacity>
                                                                        <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: theme.colors.text }}>
                                                                            {p.name}
                                                                        </Text>
                                                                        <View
                                                                            style={{
                                                                                paddingHorizontal: 5,
                                                                                paddingVertical: 1,
                                                                                borderRadius: 4,
                                                                                marginRight: 6,
                                                                                backgroundColor: isGuestOrImported ? '#FFF3E0' : '#E3F2FD'
                                                                            }}
                                                                        >
                                                                            <Text style={{ fontSize: 9, fontWeight: 'bold', color: isGuestOrImported ? '#E65100' : '#1565C0' }}>
                                                                                {isGuestOrImported ? 'Ospite/Imp.' : 'Membro'}
                                                                            </Text>
                                                                        </View>
                                                                        <TouchableOpacity
                                                                            style={{
                                                                                paddingHorizontal: 6,
                                                                                paddingVertical: 2,
                                                                                borderRadius: 4,
                                                                                backgroundColor: theme.colors.primary + '18',
                                                                                marginRight: 4
                                                                            }}
                                                                            onPress={() => setRemappingPlayer(p)}
                                                                        >
                                                                            <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: 'bold' }}>
                                                                                🔗 Collega
                                                                            </Text>
                                                                        </TouchableOpacity>
                                                                        <TouchableOpacity
                                                                            style={{
                                                                                paddingHorizontal: 5,
                                                                                paddingVertical: 2,
                                                                                borderRadius: 4,
                                                                                backgroundColor: '#FFEBEE'
                                                                            }}
                                                                            onPress={() => setSelectedRoster(prev => prev.filter(x => x.id !== p.id))}
                                                                        >
                                                                            <Text style={{ fontSize: 10, color: '#C8323C', fontWeight: 'bold' }}>✕</Text>
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                );
                                                            })}
                                                        </View>
                                                    </ScrollView>
                                                </View>
                                            )}

                                            {/* Azioni Rapide Selezione */}
                                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                                                <TouchableOpacity
                                                    style={[styles.smallChip, { backgroundColor: '#B8338A' }]}
                                                    onPress={() => {
                                                        const females = allMembers.filter(m => m.gender === 'F').map(m => ({
                                                            id: m.id,
                                                            name: m.nickname || m.firstName,
                                                            g: 'F' as const
                                                        }));
                                                        const others = selectedRoster.filter(p => p.g !== 'F');
                                                        setSelectedRoster([...others, ...females]);
                                                    }}
                                                >
                                                    <Text style={styles.smallChipText}>+ Tutte le Donne</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.smallChip, { backgroundColor: '#1F6FD1' }]}
                                                    onPress={() => {
                                                        const males = allMembers.filter(m => m.gender !== 'F').map(m => ({
                                                            id: m.id,
                                                            name: m.nickname || m.firstName,
                                                            g: 'M' as const
                                                        }));
                                                        const others = selectedRoster.filter(p => p.g === 'F');
                                                        setSelectedRoster([...others, ...males]);
                                                    }}
                                                >
                                                    <Text style={styles.smallChipText}>+ Tutti gli Uomini</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.smallChip, { backgroundColor: '#888' }]}
                                                    onPress={() => setSelectedRoster([])}
                                                >
                                                    <Text style={styles.smallChipText}>Deseleziona Tutti</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {/* Aggiunta Ospite */}
                                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                                                <TextInput
                                                    style={{ flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, color: theme.colors.text }}
                                                    placeholder="Nome Ospite..."
                                                    placeholderTextColor={theme.colors.textSecondary}
                                                    value={newGuestName}
                                                    onChangeText={setNewGuestName}
                                                />
                                                <TouchableOpacity
                                                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: newGuestGender === 'F' ? '#B8338A' : '#1F6FD1' }}
                                                    onPress={() => setNewGuestGender(prev => prev === 'F' ? 'M' : 'F')}
                                                >
                                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{newGuestGender}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: theme.colors.primary }}
                                                    onPress={() => {
                                                        if (!newGuestName.trim()) return;
                                                        const guestId = `guest_${Date.now()}`;
                                                        setSelectedRoster(prev => [...prev, { id: guestId, name: newGuestName.trim(), g: newGuestGender, isGuest: true }]);
                                                        setNewGuestName('');
                                                    }}
                                                >
                                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ Ospite</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {/* Lista Membri con Spunte */}
                                            <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                                <View style={{ gap: 4 }}>
                                                    {allMembers.map(m => {
                                                        const mGender: 'M' | 'F' = m.gender === 'F' ? 'F' : 'M';
                                                        const isSelected = selectedRoster.some(p => p.id === m.id);
                                                        return (
                                                            <TouchableOpacity
                                                                key={m.id}
                                                                style={{
                                                                    flexDirection: 'row',
                                                                    alignItems: 'center',
                                                                    paddingVertical: 6,
                                                                    paddingHorizontal: 8,
                                                                    borderRadius: 6,
                                                                    backgroundColor: isSelected ? theme.colors.primary + '14' : 'transparent',
                                                                }}
                                                                onPress={() => {
                                                                    if (isSelected) {
                                                                        setSelectedRoster(prev => prev.filter(p => p.id !== m.id));
                                                                    } else {
                                                                        setSelectedRoster(prev => [...prev, { id: m.id, name: m.nickname || m.firstName, g: mGender }]);
                                                                    }
                                                                }}
                                                            >
                                                                <Text style={{ width: 22, fontSize: 12, fontWeight: 'bold', color: mGender === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                                                    {mGender}
                                                                </Text>
                                                                <Text style={{ flex: 1, fontSize: 13, color: theme.colors.text }}>
                                                                    {m.nickname || m.firstName} {m.lastName || ''}
                                                                </Text>
                                                                <Text style={{ fontSize: 14, color: isSelected ? theme.colors.primary : theme.colors.textSecondary, fontWeight: 'bold' }}>
                                                                    {isSelected ? '✓' : '○'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                                onPress={onClose}
                            >
                                <Text style={{ color: theme.colors.text }}>Annulla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
                                onPress={onSaveMatch}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Salva Partita</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};
