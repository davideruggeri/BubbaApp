// components/liveMatch/MatchRosterModal.tsx
// Modale per la gestione dei convocati della partita, aggiunta ospiti al volo e collegamento/rimappatura a membri ufficiali

import React, { useState, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { styles } from './liveMatchStyles';
import { useTheme } from '../../context/ThemeContext';
import { MatchAnalysis, MatchRosterPlayer, Member } from '../../services/firestore';
import { showConfirmation } from '../../utils/alert';

interface MatchRosterModalProps {
    visible: boolean;
    onClose: () => void;
    match: MatchAnalysis;
    matchRoster: MatchRosterPlayer[];
    allMembers: Member[];
    onUpdateCustomRoster: (newRoster: any[]) => Promise<void>;
    onRemovePlayerFromRoster: (id: string, name: string) => void;
    onRemapPlayer: (from: any, to: Member) => void;
}

export default function MatchRosterModal({
    visible,
    onClose,
    match,
    matchRoster,
    allMembers,
    onUpdateCustomRoster,
    onRemovePlayerFromRoster,
    onRemapPlayer,
}: MatchRosterModalProps) {
    const { theme } = useTheme();

    const [remappingPlayer, setRemappingPlayer] = useState<{ id: string; name: string; g: 'M' | 'F' } | null>(null);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [allMemberSearchQuery, setAllMemberSearchQuery] = useState('');
    const [newGuestName, setNewGuestName] = useState('');
    const [newGuestGender, setNewGuestGender] = useState<'M' | 'F'>('F');

    const filteredMembersToRemap = useMemo(() => {
        if (!memberSearchQuery.trim()) return allMembers;
        const q = memberSearchQuery.toLowerCase().trim();
        return allMembers.filter(m => {
            const f = (m.firstName || '').toLowerCase();
            const l = (m.lastName || '').toLowerCase();
            const n = (m.nickname || '').toLowerCase();
            return f.includes(q) || l.includes(q) || n.includes(q);
        });
    }, [allMembers, memberSearchQuery]);

    const filteredAllMembers = useMemo(() => {
        if (!allMemberSearchQuery.trim()) return allMembers;
        const q = allMemberSearchQuery.toLowerCase().trim();
        return allMembers.filter(m => {
            const f = (m.firstName || '').toLowerCase();
            const l = (m.lastName || '').toLowerCase();
            const n = (m.nickname || '').toLowerCase();
            return f.includes(q) || l.includes(q) || n.includes(q);
        });
    }, [allMembers, allMemberSearchQuery]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={() => {
                if (remappingPlayer) setRemappingPlayer(null);
                else onClose();
            }}
        >
            <View style={styles.modalBg}>
                <View style={[styles.modalBox, { backgroundColor: theme.colors.card, maxHeight: '90%' }]}>
                    {remappingPlayer ? (
                        /* Sub-view: Collegamento a Membro Bubba */
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={[styles.cardTitle, { color: theme.colors.text, fontSize: 16 }]}>
                                    🔗 Collega a Membro Bubba
                                </Text>
                                <TouchableOpacity
                                    style={{ padding: 4 }}
                                    onPress={() => {
                                        setRemappingPlayer(null);
                                        setMemberSearchQuery('');
                                    }}
                                >
                                    <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: 'bold' }}>Annulla</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FFE0B2', marginBottom: 10 }}>
                                <Text style={{ fontSize: 12, color: '#E65100', fontWeight: 'bold' }}>
                                    Stai collegando: {remappingPlayer.name} ({remappingPlayer.g})
                                </Text>
                                <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                                    Seleziona a quale membro ufficiale assegnare tutti gli eventi registrati (gol, assist, difese, presenze in linea).
                                </Text>
                            </View>

                            <TextInput
                                style={{
                                    borderWidth: 1,
                                    borderColor: theme.colors.border,
                                    borderRadius: 8,
                                    paddingHorizontal: 10,
                                    paddingVertical: 7,
                                    fontSize: 13,
                                    color: theme.colors.text,
                                    marginBottom: 8
                                }}
                                placeholder="Cerca membro per nome o soprannome..."
                                placeholderTextColor={theme.colors.textSecondary}
                                value={memberSearchQuery}
                                onChangeText={setMemberSearchQuery}
                            />

                            <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
                                <View style={{ gap: 6 }}>
                                    {filteredMembersToRemap.length === 0 ? (
                                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, padding: 8, textAlign: 'center' }}>
                                            Nessun membro trovato con questa ricerca.
                                        </Text>
                                    ) : (
                                        filteredMembersToRemap.map(m => {
                                            const mGender: 'M' | 'F' = m.gender === 'F' ? 'F' : 'M';
                                            return (
                                                <TouchableOpacity
                                                    key={m.id}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        paddingVertical: 9,
                                                        paddingHorizontal: 12,
                                                        borderRadius: 8,
                                                        borderWidth: 1,
                                                        borderColor: theme.colors.border,
                                                        backgroundColor: 'rgba(0,0,0,0.02)'
                                                    }}
                                                    onPress={() => {
                                                        const mName = m.nickname || m.firstName;
                                                        showConfirmation(
                                                            'Collega Giocatore',
                                                            `Vuoi collegare "${remappingPlayer.name}" a "${mName}"? Tutti gli eventi e le statistiche storiche verranno aggiornati.`,
                                                            () => {
                                                                onRemapPlayer(remappingPlayer, m);
                                                                setRemappingPlayer(null);
                                                            },
                                                            'Collega'
                                                        );
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: mGender === 'F' ? '#B8338A' : '#1F6FD1', width: 22 }}>
                                                        {mGender}
                                                    </Text>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>
                                                            {m.nickname || m.firstName} {m.lastName || ''}
                                                        </Text>
                                                        {m.nickname && m.firstName && (
                                                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                                                {m.firstName} {m.lastName}
                                                            </Text>
                                                        )}
                                                    </View>
                                                    <View style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Collega ➔</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })
                                    )}
                                </View>
                            </ScrollView>
                        </View>
                    ) : (
                        /* Vista Principale: Gestione Roster Convocati */
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                                Gestione Convocati Partita ({matchRoster.length})
                            </Text>
                            <Text style={[styles.muted, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
                                Modifica i convocati della partita e collega giocatori importati o ospiti ai membri Bubba.
                            </Text>

                            {/* Lista Convocati Attuali con Azioni */}
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.text, marginTop: 4, marginBottom: 6 }}>
                                Convocati in questa Partita:
                            </Text>
                            <View style={{ maxHeight: 200, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 6, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                                <ScrollView nestedScrollEnabled>
                                    <View style={{ gap: 6 }}>
                                        {matchRoster.map(p => {
                                            const isGuestOrImported = p.id.startsWith('guest_') || p.id.startsWith('imported_') || (p as any).isGuest;
                                            return (
                                                <View
                                                    key={p.id}
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
                                                >
                                                    <TouchableOpacity
                                                        disabled={!isGuestOrImported}
                                                        onPress={async () => {
                                                            if (!isGuestOrImported) return;
                                                            const current = match.customRoster && match.customRoster.length > 0
                                                                ? [...match.customRoster]
                                                                : matchRoster.map(x => ({ id: x.id, name: x.name, g: x.g }));
                                                            const nextG: 'M' | 'F' = p.g === 'F' ? 'M' : 'F';
                                                            const updated = current.map(x => x.id === p.id ? { ...x, g: nextG } : x);
                                                            await onUpdateCustomRoster(updated);
                                                        }}
                                                        style={{
                                                            paddingHorizontal: 5,
                                                            paddingVertical: 2,
                                                            borderRadius: 4,
                                                            backgroundColor: isGuestOrImported ? (p.g === 'F' ? '#FCE4EC' : '#E3F2FD') : 'transparent',
                                                            marginRight: 6
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: p.g === 'F' ? '#B8338A' : '#1F6FD1' }}>
                                                            {p.g}{isGuestOrImported ? ' ⇄' : ''}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>
                                                            {p.name}
                                                        </Text>
                                                    </View>
                                                    <View
                                                        style={{
                                                            paddingHorizontal: 6,
                                                            paddingVertical: 2,
                                                            borderRadius: 4,
                                                            marginRight: 6,
                                                            backgroundColor: isGuestOrImported ? '#FFF3E0' : '#E3F2FD'
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: isGuestOrImported ? '#E65100' : '#1565C0' }}>
                                                            {isGuestOrImported ? 'Ospite/Imp.' : 'Membro'}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={{
                                                            paddingHorizontal: 8,
                                                            paddingVertical: 4,
                                                            borderRadius: 5,
                                                            backgroundColor: theme.colors.primary + '18',
                                                            marginRight: 4
                                                        }}
                                                        onPress={() => setRemappingPlayer(p)}
                                                    >
                                                        <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: 'bold' }}>
                                                            🔗 Collega
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={{
                                                            paddingHorizontal: 6,
                                                            paddingVertical: 4,
                                                            borderRadius: 5,
                                                            backgroundColor: '#FFEBEE'
                                                        }}
                                                        onPress={() => onRemovePlayerFromRoster(p.id, p.name)}
                                                    >
                                                        <Text style={{ fontSize: 11, color: '#C8323C', fontWeight: 'bold' }}>✕</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            </View>

                            {/* Aggiunta Ospite Esterno */}
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.text, marginTop: 12, marginBottom: 4 }}>
                                Aggiungi Ospite al Volo:
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                                <TextInput
                                    style={{ flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, color: theme.colors.text }}
                                    placeholder="Nome Ospite..."
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={newGuestName}
                                    onChangeText={setNewGuestName}
                                />
                                <TouchableOpacity
                                    style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: newGuestGender === 'F' ? '#B8338A' : '#1F6FD1' }}
                                    onPress={() => setNewGuestGender(prev => prev === 'F' ? 'M' : 'F')}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{newGuestGender}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: theme.colors.primary }}
                                    onPress={async () => {
                                        if (!newGuestName.trim()) return;
                                        const guestId = `guest_${Date.now()}`;
                                        const current = match.customRoster && match.customRoster.length > 0
                                            ? [...match.customRoster]
                                            : matchRoster.map(p => ({ id: p.id, name: p.name, g: p.g }));
                                        const updated = [...current, { id: guestId, name: newGuestName.trim(), g: newGuestGender, isGuest: true }];
                                        await onUpdateCustomRoster(updated);
                                        setNewGuestName('');
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>+ Aggiungi</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Aggiungi Membri Societari */}
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.text, marginTop: 12, marginBottom: 4 }}>
                                Aggiungi / Rimuovi Membri Società:
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                <TouchableOpacity
                                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: '#B8338A' }}
                                    onPress={async () => {
                                        const females = allMembers.filter(m => m.gender === 'F').map(m => ({
                                            id: m.id,
                                            name: m.nickname || m.firstName,
                                            g: 'F' as const
                                        }));
                                        const others = matchRoster.filter(p => p.g !== 'F');
                                        await onUpdateCustomRoster([...others, ...females]);
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ Tutte le Donne</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: '#1F6FD1' }}
                                    onPress={async () => {
                                        const males = allMembers.filter(m => m.gender !== 'F').map(m => ({
                                            id: m.id,
                                            name: m.nickname || m.firstName,
                                            g: 'M' as const
                                        }));
                                        const others = matchRoster.filter(p => p.g === 'F');
                                        await onUpdateCustomRoster([...others, ...males]);
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ Tutti gli Uomini</Text>
                                </TouchableOpacity>
                            </View>

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
                                placeholder="Filtra membri per nome..."
                                placeholderTextColor={theme.colors.textSecondary}
                                value={allMemberSearchQuery}
                                onChangeText={setAllMemberSearchQuery}
                            />

                            <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                <View style={{ gap: 4 }}>
                                    {filteredAllMembers.map(m => {
                                        const mGender: 'M' | 'F' = m.gender === 'F' ? 'F' : 'M';
                                        const isCalled = matchRoster.some(x => x.id === m.id);
                                        return (
                                            <TouchableOpacity
                                                key={m.id}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    paddingVertical: 6,
                                                    paddingHorizontal: 8,
                                                    borderRadius: 6,
                                                    borderWidth: 1,
                                                    borderColor: isCalled ? theme.colors.primary : theme.colors.border,
                                                    backgroundColor: isCalled ? theme.colors.primary + '12' : 'transparent'
                                                }}
                                                onPress={async () => {
                                                    const current = match.customRoster && match.customRoster.length > 0
                                                        ? [...match.customRoster]
                                                        : matchRoster.map(x => ({ id: x.id, name: x.name, g: x.g }));
                                                    const exists = current.some(x => x.id === m.id);
                                                    const updated = exists
                                                        ? current.filter(x => x.id !== m.id)
                                                        : [...current, { id: m.id, name: m.nickname || m.firstName, g: mGender }];
                                                    await onUpdateCustomRoster(updated);
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: mGender === 'F' ? '#B8338A' : '#1F6FD1', width: 20 }}>
                                                    {mGender}
                                                </Text>
                                                <Text style={{ flex: 1, fontSize: 13, color: theme.colors.text }}>
                                                    {m.nickname || m.firstName} {m.lastName || ''}
                                                </Text>
                                                <Text style={{ fontSize: 15, color: isCalled ? theme.colors.primary : theme.colors.textSecondary, fontWeight: 'bold' }}>
                                                    {isCalled ? '✓' : '○'}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </ScrollView>

                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 }}>
                                <TouchableOpacity
                                    style={[styles.startPtBtn, { paddingHorizontal: 24 }]}
                                    onPress={onClose}
                                >
                                    <Text style={styles.startPtText}>Fatto</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}
